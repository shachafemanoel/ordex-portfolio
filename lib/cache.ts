import { isTenantRuntime, requireTenantId } from '@/lib/tenancy/context';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { getRedisClient as getUnifiedRedisClient } from '@/lib/redis';
import { Prisma } from '@prisma/client';
import { RedisClientType } from 'redis';

// Use the unified Redis client from redis.ts
export async function getRedisClient(): Promise<RedisClientType> {
  const client = await getUnifiedRedisClient();
  if (!client) {
    throw new Error('Redis client not available');
  }
  return client;
}

// Cache Configuration
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  serialize?: boolean;
}

const DEFAULT_TTL = 300; // 5 minutes
const DEFAULT_PREFIX = 'oms';

// Cache Utility Class
import { LRUCache } from 'lru-cache';

// Cache Utility Class
export class CacheManager {
  private redis: RedisClientType | null = null;
  private fallbackCache: LRUCache<string, string>;

  constructor(private options: CacheOptions = {}) {
    this.fallbackCache = new LRUCache<string, string>({
      max: 1000,
      ttl: (options.ttl || DEFAULT_TTL) * 1000,
      allowStale: false,
      updateAgeOnGet: true,
      dispose: (value, key) => {
        if (process.env.DEBUG_MEMORY === '1') {
          console.debug(`[CacheManager] Evicted key: ${key}`);
        }
      },
    });

    if (process.env.DEBUG_MEMORY === '1') {
      console.debug(
        `[CacheManager] Initialized with max=${this.fallbackCache.max}, ttl=${this.fallbackCache.ttl}`
      );
    }
  }

  // Proper disposal for shutdown hooks
  dispose() {
    this.fallbackCache.clear();
    if (this.redis) {
      // Best effort disconnect without await to avoid blocking shutdown loop too long
      this.redis.disconnect().catch((err) => console.error('Redis disconnect error', err));
    }
    if (process.env.DEBUG_MEMORY === '1') {
      console.debug('[CacheManager] Disposed');
    }
  }

  private async getClient(): Promise<RedisClientType | null> {
    try {
      if (!this.redis) {
        // Use unified Redis client and gracefully handle failures
        this.redis = await getUnifiedRedisClient();
      }
      return this.redis;
    } catch (error) {
      console.warn('Redis unavailable, using in-memory fallback:', error);
      return null;
    }
  }

  private async createKey(key: string): Promise<string> {
    const prefix = this.options.prefix || DEFAULT_PREFIX;
    const business = isTenantRuntime() ? `${await requireTenantId()}:` : '';
    return `${prefix}:${business}${key}`;
  }

  private serialize(value: any): string {
    return this.options.serialize !== false ? JSON.stringify(value) : value;
  }

  private deserialize(value: string | null): any {
    if (value === null) return null;

    try {
      return this.options.serialize !== false ? JSON.parse(value) : value;
    } catch {
      return value;
    }
  }

  // Set cache value
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const cacheKey = await this.createKey(key);
    const serialized = this.serialize(value);
    const expiry = ttl || this.options.ttl || DEFAULT_TTL;

    try {
      const client = await this.getClient();
      if (client) {
        await client.setEx(cacheKey, expiry, serialized);
      } else {
        // Fallback to in-memory cache (LRU handles eviction)
        this.fallbackCache.set(cacheKey, serialized, { ttl: expiry * 1000 });

        if (process.env.DEBUG_MEMORY === '1') {
          console.debug(`[CacheManager] Set key: ${cacheKey}, size: ${this.fallbackCache.size}`);
        }
      }
    } catch (error) {
      console.error('Cache set error:', error);
      // Fallback to in-memory cache
      this.fallbackCache.set(cacheKey, serialized, { ttl: expiry * 1000 });
    }
  }

  // Get cache value
  async get(key: string): Promise<any> {
    const cacheKey = await this.createKey(key);

    try {
      const client = await this.getClient();
      if (client) {
        const value = await client.get(cacheKey);
        return this.deserialize(value);
      } else {
        // Fallback to in-memory cache
        const cached = this.fallbackCache.get(cacheKey); // LRU handles expiry check
        return this.deserialize(cached || null);
      }
    } catch (error) {
      console.error('Cache get error:', error);
      // Try fallback cache
      const cached = this.fallbackCache.get(cacheKey);
      return this.deserialize(cached || null);
    }
  }

  // Delete cache value
  async del(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    const cacheKeys = await Promise.all(keys.map((k) => this.createKey(k)));

    try {
      const client = await this.getClient();
      if (client) {
        await client.del(cacheKeys);
      }
      // Also clear from fallback cache
      cacheKeys.forEach((k) => this.fallbackCache.delete(k));
    } catch (error) {
      console.error('Cache delete error:', error);
      // Clear from fallback cache
      cacheKeys.forEach((k) => this.fallbackCache.delete(k));
    }
  }

  // Clear cache by pattern
  async clearPattern(pattern: string): Promise<void> {
    const fullPattern = await this.createKey(pattern);

    try {
      const client = await this.getClient();
      if (client) {
        const keys = await client.keys(fullPattern);
        if (keys.length > 0) {
          await client.del(keys);
        }
      }
      // Clear matching keys from fallback cache
      // LRUCache doesn't support key iteration efficiently for pattern matching without full scan
      // For fallback mode, we accept doing a full memory scan as it is capped (e.g. 1000 items)
      for (const k of this.fallbackCache.keys()) {
        const matcher = new RegExp('^' + fullPattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
        if (matcher.test(k)) {
          this.fallbackCache.delete(k);
        }
      }
    } catch (error) {
      console.error('Cache clear pattern error:', error);
    }
  }

  // Cache with automatic refresh
  async getOrSet<T>(key: string, factory: () => Promise<T> | T, ttl?: number): Promise<T> {
    let value = await this.get(key);

    if (value === null || value === undefined) {
      value = await factory();
      if (value !== null && value !== undefined) {
        await this.set(key, value, ttl);
      }
    }

    return value;
  }

  // Increment counter
  async incr(key: string, ttl?: number): Promise<number> {
    const cacheKey = await this.createKey(key);

    try {
      const client = await this.getClient();
      if (client) {
        const result = await client.incr(cacheKey);
        if (ttl && result === 1) {
          await client.expire(cacheKey, ttl);
        }
        return result;
      } else {
        // Fallback implementation
        const cached = this.fallbackCache.get(cacheKey);
        const current = cached ? parseInt(cached) || 0 : 0;
        const newValue = current + 1;
        const expiry = ttl ? ttl * 1000 : undefined; // inherit previous TTL if undefined not strictly supported by LRU update

        // If ttl provided, update it. If not, LRUCache normally updates recency but not TTL unless specified.
        this.fallbackCache.set(cacheKey, newValue.toString(), { ttl: expiry });
        return newValue;
      }
    } catch (error) {
      console.error('Cache incr error:', error);
      return 1;
    }
  }

  // Health check
  async health(): Promise<{ redis: boolean; fallback: boolean }> {
    try {
      const client = await this.getClient();
      if (client) {
        await client.ping();
        return { redis: true, fallback: false };
      }
      return { redis: false, fallback: true };
    } catch {
      return { redis: false, fallback: true };
    }
  }
}

// Predefined cache instances for different purposes
export const ordersCache = new CacheManager({
  prefix: 'oms:orders',
  ttl: 300, // 5 minutes
});

export const reportsCache = new CacheManager({
  prefix: 'oms:reports',
  ttl: 600, // 10 minutes
});

export const dashboardCache = new CacheManager({
  prefix: 'oms:dashboard',
  ttl: 180, // 3 minutes
});

export const integrationCache = new CacheManager({
  prefix: 'oms:integrations',
  ttl: 900, // 15 minutes
});

// Enhanced cache invalidation strategies
export interface CacheInvalidationContext {
  orderId?: string;
  customerId?: string;
  supplierId?: string;
  status?: string;
  operation: 'create' | 'update' | 'delete' | 'status_change';
  correlationId?: string;
}

/**
 * Intelligent cache invalidation with dependency tracking
 */
export async function invalidateOrderCache(context: CacheInvalidationContext): Promise<void> {
  const { orderId, customerId, supplierId, status, operation } = context;

  // Specific order cache invalidation
  if (orderId) {
    await Promise.all([
      ordersCache.del(`order:${orderId}`),
      ordersCache.del(`order:${orderId}:items`),
      ordersCache.del(`order:${orderId}:status_log`),
    ]);
  }

  // Customer-specific invalidation
  if (customerId) {
    await ordersCache.del(`customer:${customerId}:orders`);
  }

  // Supplier-specific invalidation
  if (supplierId) {
    await ordersCache.del(`supplier:${supplierId}:orders`);
  }

  // Smart invalidation based on operation
  switch (operation) {
    case 'create':
      // Invalidate lists, counters, and dashboard data
      await Promise.all([
        ordersCache.del(['orders:recent', 'orders:count', 'orders:by_status']),
        dashboardCache.del(['dashboard:summary', 'dashboard:stats']),
        reportsCache.del(['orders:today', 'orders:this_week']),
      ]);
      break;

    case 'update':
      // Targeted invalidation for updates
      await Promise.all([
        ordersCache.del(['orders:recent']),
        dashboardCache.del('dashboard:summary'),
      ]);
      break;

    case 'status_change':
      // Status-specific invalidation
      await Promise.all([
        ordersCache.del(['orders:by_status', `orders:status:${status}`]),
        dashboardCache.del(['dashboard:summary', 'dashboard:status_counts']),
        reportsCache.del(['orders:pipeline', 'orders:completion_rate']),
      ]);
      break;

    case 'delete':
      // Comprehensive invalidation for deletes
      await Promise.all([
        ordersCache.clearPattern('orders:*'),
        dashboardCache.clearPattern('*'),
        reportsCache.clearPattern('*'),
      ]);
      break;

    default:
      // Conservative approach for unknown operations
      await ordersCache.clearPattern('orders:*');
  }

  // Invalidate related aggregated data
  await Promise.all([
    dashboardCache.clearPattern('dashboard:*'),
    reportsCache.del(['revenue:monthly', 'orders:summary']),
  ]);
}

/**
 * Cache invalidation with dependency graph
 */
export async function invalidateCacheDependencies(
  entityType: string,
  _entityId: string,
  _operation: string
): Promise<void> {
  const dependencies: Record<string, string[]> = {
    order: ['dashboard:*', 'reports:*', 'orders:*'],
    customer: ['dashboard:customers', 'reports:customer*', 'orders:customer:*'],
    supplier: ['suppliers:*', 'reports:supplier*', 'orders:supplier:*'],
  };

  const patterns = dependencies[entityType] || [];

  await Promise.all(
    patterns.map((pattern) =>
      pattern.endsWith('*') ? ordersCache.clearPattern(pattern) : ordersCache.del(pattern)
    )
  );
}

/**
 * Bulk cache invalidation for batch operations
 */
export async function bulkInvalidateCache(
  operations: Array<{
    type: string;
    id: string;
    operation: string;
  }>
): Promise<void> {
  const uniquePatterns = new Set<string>();

  // Collect all patterns that need invalidation
  operations.forEach((op) => {
    const dependencies: Record<string, string[]> = {
      order: ['orders:*', 'dashboard:*'],
      customer: ['customers:*'],
      supplier: ['suppliers:*'],
    };

    const patterns = dependencies[op.type] || [];
    patterns.forEach((pattern) => uniquePatterns.add(pattern));
  });

  // Execute invalidation in parallel
  await Promise.all(
    Array.from(uniquePatterns).map((pattern) =>
      pattern.endsWith('*') ? ordersCache.clearPattern(pattern) : ordersCache.del(pattern)
    )
  );
}

export async function invalidateSupplierCache(supplierId?: string): Promise<void> {
  if (supplierId) {
    await ordersCache.del(`supplier:${supplierId}`);
  }
  await ordersCache.clearPattern('suppliers:*');
}

export async function invalidateClientCache(clientId?: string): Promise<void> {
  if (clientId) {
    await ordersCache.del(`client:${clientId}`);
  }
  await ordersCache.clearPattern('clients:*');
}

// Intelligent cache warming based on common query patterns
export async function warmupCaches(): Promise<void> {
  console.log('Warming up caches...');

  try {
    // Import prisma client for cache warming queries
    const { prisma } = await import('@/lib/db');

    // Warm up dashboard statistics
    await dashboardCache.getOrSet(
      'dashboard:summary',
      async () => {
        const [totalOrders, statusGroups] = await Promise.all([
          prisma.order.count(),
          prisma.order.groupBy({
            by: ['status'],
            _count: { id: true },
          }),
        ]);

        const statusAggregation = statusGroups.reduce<Record<string, number>>((acc, g: any) => {
          const normalized = normalizeOrderStatus(g.status);
          acc[normalized] = (acc[normalized] ?? 0) + (g._count.id ?? 0);
          return acc;
        }, {});

        return {
          totalOrders,
          statusCounts: Object.entries(statusAggregation).map(([status, count]) => ({
            status,
            count,
          })),
        };
      },
      180
    ); // 3 minutes TTL

    // Warm up recent orders cache
    await ordersCache.getOrSet(
      'orders:recent',
      async () => {
        try {
          return await prisma.order.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: {
              customer: { select: { name: true } },
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
            console.warn('Orders cache warmup skipped due to legacy schema (missing columns).');
            return [];
          }
          throw error;
        }
      },
      300
    ); // 5 minutes TTL

    // Warm up active suppliers cache
    await ordersCache.getOrSet(
      'suppliers:active',
      async () => {
        try {
          return await prisma.supplier.findMany({
            orderBy: {
              name: 'asc',
            },
            take: 20,
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
            console.warn('Suppliers cache warmup skipped due to legacy schema.');
            return [];
          }
          throw error;
        }
      },
      600
    ); // 10 minutes TTL

    console.log('Cache warmup completed successfully');
  } catch (error) {
    console.error('Cache warmup failed:', error);
  }
}
