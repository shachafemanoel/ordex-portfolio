/**
 * Database connection and Prisma client setup with enhanced reliability
 * Includes connection pooling, retry logic, and circuit breaker pattern
 */

import { logger } from '@/lib/logger';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { withSslModeRequire } from '@/lib/db/connection-url';
import { isTenantRuntime, requireTenantContext, tenantTransactionStorage } from '@/lib/tenancy/context';

// =============================================================================
// BUILD PHASE DETECTION
// =============================================================================

const isBuildPhase =
  process.env.DOCKER_BUILD === 'true' ||
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.SKIP_DB_ON_BUILD === 'true';

// =============================================================================
// PRISMA CLIENT INITIALIZATION
// =============================================================================

const g = globalThis as unknown as { prisma?: PrismaClient };

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  const message = typeof error === 'string' ? error : JSON.stringify(error);
  return new Error(message);
}

const RETRYABLE_PRISMA_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017']);
const RETRYABLE_MESSAGE =
  /ECONNRESET|ETIMEOUT|connection (terminated|closed)|too many clients|database is locked/i;

function isRetryablePrismaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  if (err.code && RETRYABLE_PRISMA_CODES.has(err.code)) return true;
  return err.message ? RETRYABLE_MESSAGE.test(err.message) : false;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DATABASE_URL = withSslModeRequire(process.env.DATABASE_URL);

// During build phase, use a dummy URL; at runtime, use the real DATABASE_URL.
const EFFECTIVE_DATABASE_URL = isBuildPhase && !DATABASE_URL
  ? 'postgresql://build:build@localhost:5432/build'
  : DATABASE_URL;

const pool = new Pool({
  connectionString: EFFECTIVE_DATABASE_URL ?? undefined,
  max: isBuildPhase ? 0 : (process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: isBuildPhase ? 1000 : 10000,
  ssl:
    !isBuildPhase &&
    EFFECTIVE_DATABASE_URL &&
    !EFFECTIVE_DATABASE_URL.includes('localhost') &&
    !EFFECTIVE_DATABASE_URL.includes('127.0.0.1')
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on('error', (err) => {
  if (!isBuildPhase) {
    logger.error('Unexpected error on idle database client', err);
  }
});

const adapter = new PrismaPg(pool);

const baseClient = new PrismaClient({
  adapter,
  log: isTenantRuntime() ? [] : process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  errorFormat: 'minimal',
});

// Extend with retry logic using $extends (required for driver adapters)
const extendedClient = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        let attempt = 0;
        let lastError: unknown;

        while (attempt < 3) {
          try {
            return await query(args);
          } catch (error) {
            lastError = error;
            if (!isRetryablePrismaError(error) || attempt === 2) {
              throw error;
            }

            const backoff = 200 * (attempt + 1);
            logger.warn(`Prisma operation retry ${attempt + 1}/3 for ${model}.${operation}`, {
              component: 'database',
              code: (error as any)?.code,
              backoff,
            });

            attempt++;
            await sleep(backoff);
          }
        }
        throw lastError;
      },
    },
  },
});

const safeDeleteExtension = Prisma.defineExtension({
  name: 'safe-delete',
  query: {
    order: {
      async delete() {
        throw new Error(
          'HARD DELETE BLOCKED: Order.delete() is forbidden. Use update({ data: { deletedAt: new Date() } }) or status="CANCELLED" instead.'
        );
      },
      async deleteMany() {
        throw new Error(
          'HARD DELETE BLOCKED: Order.deleteMany() is forbidden. Use updateMany({ data: { deletedAt: new Date() } }) instead.'
        );
      },
    },
    customer: {
      async delete() {
        throw new Error(
          'HARD DELETE BLOCKED: Customer.delete() is forbidden. Soft delete is required.'
        );
      },
      async deleteMany() {
        throw new Error(
          'HARD DELETE BLOCKED: Customer.deleteMany() is forbidden. Soft delete is required.'
        );
      },
    },
  },
});

function hasModelDelegate(client: unknown, delegateName: string): boolean {
  return Boolean(
    client &&
      typeof client === 'object' &&
      delegateName in client &&
      (client as Record<string, unknown>)[delegateName]
  );
}

let roleChecked: Promise<void> | undefined;
async function assertTenantDatabaseRole(): Promise<void> {
  roleChecked ??= (async () => {
    const roles = await baseClient.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    if (roles[0]?.rolsuper || roles[0]?.rolbypassrls || !roles.length) throw new Error('Tenant runtime requires a database role without SUPERUSER or BYPASSRLS');
    const tables = Prisma.dmmf.datamodel.models.filter((model) => model.fields.some((field) => field.name === 'tenantId')).map((model) => model.dbName || model.name).concat(['users', 'tenants']);
    const checks = await baseClient.$queryRaw<Array<{ total: number; safe: boolean }>>`SELECT count(*)::int AS total, bool_and(c.relrowsecurity AND c.relforcerowsecurity AND NOT pg_has_role(current_user, c.relowner, 'MEMBER')) AS safe FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname = ANY(${tables}::text[])`;
    if (checks[0]?.total !== tables.length || !checks[0]?.safe) throw new Error('Tenant runtime requires migrated RLS tables and a non-owner runtime role');
  })().catch((error) => { roleChecked = undefined; throw error; });
  return roleChecked;
}

export async function withIdentityDatabase<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (!isTenantRuntime()) return action(baseClient);
  await assertTenantDatabaseRole();
  return baseClient.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.identity_lookup', '1', true)`;
    return action(tx);
  });
}

async function tenantDatabaseTransaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>, options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<T> {
  const current = tenantTransactionStorage.getStore();
  if (current) return action(current);
  const context = await requireTenantContext();
  await assertTenantDatabaseRole();
  return baseClient.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.tenant_id', ${context.tenantId}, true), set_config('app.user_id', ${context.userId}, true), set_config('app.tenant_role', ${context.role}, true)`;
    return tenantTransactionStorage.run(tx, async () => await action(tx));
  }, options);
}

const tenantClient = extendedClient.$extends(safeDeleteExtension).$extends({
  name: 'tenant-transactions',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!isTenantRuntime()) return query(args);
        return tenantDatabaseTransaction(async (tx) => {
          const delegate = Reflect.get(tx, model[0].toLowerCase() + model.slice(1));
          return Reflect.apply(Reflect.get(delegate, operation), delegate, [args]);
        });
      },
    },
  },
});
const freshClient = new Proxy(tenantClient, {
  get(target, property, receiver) {
    if (isTenantRuntime() && property === '$transaction') {
      return (action: unknown, options?: Parameters<typeof tenantDatabaseTransaction>[1]) => {
        if (typeof action !== 'function') throw new Error('Tenant transactions require the callback form');
        return tenantDatabaseTransaction((tx) => action(tx), options);
      };
    }
    if (isTenantRuntime() && ['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe'].includes(String(property))) {
      return (...args: unknown[]) => tenantDatabaseTransaction(async (tx) => Reflect.apply(Reflect.get(tx, property), tx, args));
    }
    return Reflect.get(target, property, receiver);
  },
}) as unknown as PrismaClient;
const cachedClient = g.prisma;
const generatedClientHasDeliverySessions = hasModelDelegate(freshClient, 'deliveryRouteSession');
const cachedClientMissingDeliverySessions =
  generatedClientHasDeliverySessions && !hasModelDelegate(cachedClient, 'deliveryRouteSession');

if (cachedClientMissingDeliverySessions) {
  logger.warn('Refreshing cached Prisma client after schema change', {
    component: 'database',
    reason: 'missing_delivery_route_session_delegate',
  });
}

const prismaClient = (cachedClientMissingDeliverySessions || !cachedClient
  ? freshClient
  : cachedClient) as PrismaClient;

// Connection warmup and health check
async function validateConnection() {
  try {
    await baseClient.$connect();
    await baseClient.$queryRaw`SELECT 1`;
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Database connection failed', toError(error));
    return false;
  }
}

async function initializePrisma(retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    if (await validateConnection()) return true;
    logger.warn(`Connection attempt ${i + 1} failed, retrying...`);
    await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
  }
  return false;
}

const explicitSkip = process.env.SKIP_PRISMA_INIT === 'true';
const isTestEnv = process.env.NODE_ENV === 'test';
const skipPrismaInitialization =
  explicitSkip || isBuildPhase || (isTestEnv && process.env.NODE_ENV !== 'production');

if (!skipPrismaInitialization) {
  initializePrisma().catch((error) => {
    logger.error('Failed to initialize Prisma (continuing startup)', toError(error));
  });
}

g.prisma = prismaClient;

export const prisma = prismaClient;

// =============================================================================
// ENHANCED FEATURES (Circuit Breaker, Connection Pooling, etc.)
// =============================================================================

class DatabaseCircuitBreaker {
  private failureCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextAttempt = 0;
  private readonly threshold = 2;
  private readonly timeout = 15000;
  private lastSuccessTime = Date.now();

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Database circuit breaker is OPEN - too many failures');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastSuccessTime = Date.now();
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }

  getState(): string {
    return this.state;
  }

  getHealthInfo() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt,
      timeSinceLastSuccess: Date.now() - this.lastSuccessTime,
      threshold: this.threshold,
      timeout: this.timeout,
    };
  }
}

const circuitBreaker = new DatabaseCircuitBreaker();

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  backoffMs = 200
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 50 + attempt * 25));
      }
      return await circuitBreaker.execute(fn);
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (
        error instanceof Prisma.PrismaClientValidationError ||
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        throw error;
      }

      const isRetryableError =
        /Server has closed the connection|ECONNRESET|ETIMEOUT|Connection terminated|connection pool timeout|Too many connections|Client has encountered a connection error and is not queryable|Connection closed unexpectedly|connection lost|P1017|Connection timed out/i.test(
          errorMessage
        );

      if (!isRetryableError || attempt === retries - 1) {
        break;
      }

      const baseDelay = Math.min(backoffMs * Math.pow(1.2, attempt), 2000);
      const delay = baseDelay + Math.random() * 100;
      logger.warn(
        `Database operation failed (attempt ${attempt + 1}/${retries}), retrying in ${Math.round(delay)}ms`,
        { error: errorMessage }
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function getPrismaClient() {
  return prisma;
}

export function getBasePrismaClient() {
  return prisma;
}

const connectionMetrics = {
  totalQueries: 0,
  failedQueries: 0,
  avgResponseTime: 0,
  lastError: null as Error | null,
  lastSuccess: null as Date | null,
};

export async function checkDatabaseConnection(): Promise<{
  healthy: boolean;
  message: string;
  latency?: number;
  metrics?: typeof connectionMetrics;
  circuitBreakerState?: string;
}> {
  if (isBuildPhase) {
    return {
      healthy: true,
      message: 'Build phase - DB connection mocked',
      latency: 0,
      metrics: connectionMetrics,
      circuitBreakerState: 'CLOSED',
    };
  }

  try {
    const start = Date.now();

    if (isTenantRuntime()) await assertTenantDatabaseRole();
    await connectionManager.acquireConnection(async () => {
      return await withRetry(
        async () => {
          return await baseClient.$queryRaw`SELECT 1 as health_check`;
        },
        1,
        100
      );
    });

    const latency = Date.now() - start;

    return {
      healthy: true,
      message: 'Database connection successful',
      latency,
      metrics: connectionMetrics,
      circuitBreakerState: circuitBreaker.getState(),
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown database error',
      metrics: connectionMetrics,
      circuitBreakerState: circuitBreaker.getState(),
    };
  }
}

class ConnectionManager {
  private activeConnections = 0;
  private readonly maxConnections = 2;
  private connectionQueue: Array<{ resolve: Function; reject: Function }> = [];
  private connectionTimeout = 10000;

  async acquireConnection<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.activeConnections < this.maxConnections) {
        this.executeWithConnection(operation, resolve, reject);
      } else {
        this.connectionQueue.push({ resolve, reject });

        setTimeout(() => {
          const index = this.connectionQueue.findIndex((item) => item.resolve === resolve);
          if (index !== -1) {
            this.connectionQueue.splice(index, 1);
            reject(new Error('Connection pool timeout - too many concurrent requests'));
          }
        }, this.connectionTimeout);
      }
    });
  }

  private async executeWithConnection<T>(
    operation: () => Promise<T>,
    resolve: Function,
    reject: Function
  ) {
    this.activeConnections++;
    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeConnections--;
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.connectionQueue.length > 0 && this.activeConnections < this.maxConnections) {
      const { resolve, reject } = this.connectionQueue.shift()!;
      // Queued item will be processed on next acquireConnection call
    }
  }

  getStats() {
    return {
      activeConnections: this.activeConnections,
      queueLength: this.connectionQueue.length,
      maxConnections: this.maxConnections,
    };
  }
}

const connectionManager = new ConnectionManager();

export function getConnectionMetrics() {
  return {
    ...connectionMetrics,
    circuitBreakerState: circuitBreaker.getState(),
    circuitBreakerHealth: circuitBreaker.getHealthInfo(),
    connectionPool: connectionManager.getStats(),
  };
}

export async function closeDatabaseConnection(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch (error) {
    logger.error('Error closing database connection', toError(error));
  }
}

export async function withTransaction<T>(
  operation: (
    tx: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >
  ) => Promise<T>
): Promise<T> {
  return await connectionManager.acquireConnection(async () => {
    try {
      return await withRetry(
        async () => {
          return await prisma.$transaction(
            async (tx) => {
              return await operation(tx as unknown as any);
            },
            {
              maxWait: 8000,
              timeout: 25000,
              isolationLevel: 'ReadCommitted',
            }
          );
        },
        2,
        400
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Transaction failed', { error: errorMessage });
      throw error;
    }
  });
}

// Export types for use throughout the application
export type {
  Address,
  Customer,
  Order,
  OrderItem,
  OrderItemStatus,
  OrderNote,
  OrderPriority,
  OrderStatus,
  TaskStatus,
  User,
  UserRole,
} from '@prisma/client';

export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Default export for compatibility with existing code
export default prisma;

// Export initialization functions
export { initializePrisma, validateConnection };
