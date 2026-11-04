/**
 * Database Query Instrumentation
 *
 * Instruments Prisma queries with OpenTelemetry tracing and performance monitoring
 *
 * @module lib/observability/database-instrumentation
 */

import { PrismaClient } from '@prisma/client';
import { withSpan, setSpanAttributes, SpanAttributes, addSpanEvent, isTelemetryAvailable } from '@/lib/observability/telemetry';
import { logger } from '@/lib/logger';

/**
 * Prisma operation types
 */
type PrismaOperation =
  | 'findUnique'
  | 'findFirst'
  | 'findMany'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'aggregate'
  | 'groupBy'
  | 'count';

/**
 * Query performance thresholds (ms)
 */
const SLOW_QUERY_THRESHOLD = 1000; // 1 second
const VERY_SLOW_QUERY_THRESHOLD = 5000; // 5 seconds

/**
 * Instrument Prisma Client with OpenTelemetry
 *
 * Adds middleware to track all database queries
 *
 * @param prisma - Prisma client instance
 * @returns instrumented Prisma client
 */
export function instrumentPrisma<T extends PrismaClient>(prisma: T): T {
  if (!isTelemetryAvailable()) {
    logger.debug('Prisma instrumentation skipped - telemetry not available');
    return prisma;
  }

  // Prisma 7 removed `$use` middleware; instrument query events instead.
  (prisma as PrismaClient).$on('query' as never, (event: any) => {
    const duration = Number(event?.duration || 0);
    const rawQuery = typeof event?.query === 'string' ? event.query.trim() : '';
    const operation = rawQuery.split(/\s+/)[0]?.toUpperCase() || 'QUERY';
    const dbName = process.env.DATABASE_URL?.split('/').pop()?.split('?')[0] || 'ordex';

    void withSpan(
      `Prisma ${operation}`,
      async (span) => {
        if (span) {
          setSpanAttributes({
            [SpanAttributes.DB_SYSTEM]: 'postgresql',
            [SpanAttributes.DB_NAME]: dbName,
            [SpanAttributes.DB_OPERATION]: operation,
            [SpanAttributes.QUERY_DURATION_MS]: duration,
            'db.query.success': true,
          });
        }

        if (duration > VERY_SLOW_QUERY_THRESHOLD) {
          addSpanEvent('very_slow_query', {
            duration_ms: duration,
            threshold_ms: VERY_SLOW_QUERY_THRESHOLD,
          });
          logger.warn('Very slow database query detected', {
            operation,
            duration,
            threshold: VERY_SLOW_QUERY_THRESHOLD,
          });
        } else if (duration > SLOW_QUERY_THRESHOLD) {
          addSpanEvent('slow_query', {
            duration_ms: duration,
            threshold_ms: SLOW_QUERY_THRESHOLD,
          });
          logger.warn('Slow database query detected', {
            operation,
            duration,
            threshold: SLOW_QUERY_THRESHOLD,
          });
        } else {
          logger.debug('Database query executed', { operation, duration });
        }
      },
      {
        'span.kind': 'client',
        component: 'prisma',
      }
    );
  });

  logger.info('Prisma instrumentation enabled');
  return prisma;
}

/**
 * Sanitize query arguments to remove sensitive data
 *
 * @param args - Prisma query arguments
 * @returns sanitized arguments
 */
function sanitizeQueryArgs(args: any): any {
  if (!args || typeof args !== 'object') {
    return args;
  }

  const sanitized = { ...args };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeQueryArgs(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Instrument a specific database transaction
 *
 * @param name - transaction name
 * @param fn - transaction function
 */
export async function instrumentTransaction<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!isTelemetryAvailable()) {
    return await fn();
  }

  return await withSpan(
    `Transaction: ${name}`,
    async (span) => {
      const startTime = Date.now();

      try {
        if (span) {
          setSpanAttributes({
            [SpanAttributes.DB_SYSTEM]: 'postgresql',
            'db.transaction': true,
            'db.transaction.name': name,
          });
        }

        const result = await fn();

        const duration = Date.now() - startTime;

        if (span) {
          setSpanAttributes({
            'db.transaction.duration_ms': duration,
            'db.transaction.success': true,
          });
        }

        logger.debug('Transaction completed', { name, duration });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (span) {
          setSpanAttributes({
            'db.transaction.duration_ms': duration,
            'db.transaction.success': false,
            'db.transaction.error': error instanceof Error ? error.message : String(error),
          });
        }

        logger.error('Transaction failed', error, { name, duration });

        throw error;
      }
    },
    {
      'span.kind': 'client',
      'component': 'prisma-transaction',
    }
  );
}

/**
 * Instrument a batch operation
 *
 * @param operation - batch operation name
 * @param count - number of items in batch
 * @param fn - batch function
 */
export async function instrumentBatch<T>(
  operation: string,
  count: number,
  fn: () => Promise<T>
): Promise<T> {
  if (!isTelemetryAvailable()) {
    return await fn();
  }

  return await withSpan(
    `Batch: ${operation}`,
    async (span) => {
      const startTime = Date.now();

      try {
        if (span) {
          setSpanAttributes({
            'db.batch.operation': operation,
            'db.batch.count': count,
          });
        }

        const result = await fn();

        const duration = Date.now() - startTime;

        if (span) {
          setSpanAttributes({
            'db.batch.duration_ms': duration,
            'db.batch.success': true,
            'db.batch.avg_duration_ms': duration / count,
          });
        }

        logger.info('Batch operation completed', {
          operation,
          count,
          duration,
          avgDuration: duration / count,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (span) {
          setSpanAttributes({
            'db.batch.duration_ms': duration,
            'db.batch.success': false,
          });
        }

        logger.error('Batch operation failed', error, {
          operation,
          count,
          duration,
        });

        throw error;
      }
    },
    {
      'span.kind': 'client',
      'component': 'prisma-batch',
    }
  );
}

/**
 * Create an instrumented Prisma client
 *
 * @param options - Prisma client options
 * @returns instrumented Prisma client
 */
export function createInstrumentedPrisma(options?: any): PrismaClient {
  const prisma = new PrismaClient(options);
  return instrumentPrisma(prisma);
}
