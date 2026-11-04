/**
 * Cache Manager
 *
 * Redis-backed caching infrastructure with fallback support and multiple cache strategies.
 * Provides TTL-based caching, cache invalidation, and automatic key generation.
 *
 * @module lib/cache/cache-manager
 */

import { getRedisClient, isRedisReady } from '@/lib/redis';
import { logger } from '@/lib/logger';
import type { RedisClientType } from 'redis';

/**
 * Cache strategies for write operations
 */
export enum CacheStrategy {
  /**
   * Write to cache and database together (consistency priority)
   */
  WRITE_THROUGH = 'write_through',

  /**
   * Write to database, async update cache (performance priority)
   */
  WRITE_BEHIND = 'write_behind',

  /**
   * Preemptively refresh cache before expiry
   */
  REFRESH_AHEAD = 'refresh_ahead',
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /**
   * Time-to-live in seconds (default: 300 = 5 minutes)
   */
  ttl?: number;

  /**
   * Cache key prefix (default: 'cache')
   */
  prefix?: string;

  /**
   * Cache strategy (default: WRITE_THROUGH)
   */
  strategy?: CacheStrategy;

  /**
   * Whether to use compression for large values (default: false)
   */
  compress?: boolean;

  /**
   * Whether to log cache operations (default: false)
   */
  debug?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  sets: number;
  deletes: number;
  errors: number;
}

/**
 * Cache Manager Class
 */
export class CacheManager {
  private readonly prefix: string;
  private readonly defaultTtl: number;
  private readonly strategy: CacheStrategy;
  private readonly debug: boolean;

  // Statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.prefix = options.prefix || 'cache';
    this.defaultTtl = options.ttl || 300; // 5 minutes default
    this.strategy = options.strategy || CacheStrategy.WRITE_THROUGH;
    this.debug = options.debug || false;
  }

  /**
   * Generate cache key with prefix
   */
  private getCacheKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Get Redis client (or null if unavailable)
   */
  private async getClient(): Promise<RedisClientType | null> {
    try {
      return await getRedisClient();
    } catch (error) {
      logger.warn('Redis client unavailable for caching', { error });
      return null;
    }
  }

  /**
   * Get value from cache
   *
   * @param key - cache key
   * @returns cached value or null if not found/unavailable
   */
  async get<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    if (!client || !isRedisReady()) {
      this.stats.misses++;
      return null;
    }

    try {
      const cacheKey = this.getCacheKey(key);
      const value = await client.get(cacheKey);

      if (value === null) {
        this.stats.misses++;
        if (this.debug) {
          logger.debug('Cache miss', { key: cacheKey });
        }
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      if (this.debug) {
        logger.debug('Cache hit', { key: cacheKey });
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error', error, { key });
      return null;
    }
  }

  /**
   * Set value in cache
   *
   * @param key - cache key
   * @param value - value to cache
   * @param ttl - optional TTL override (seconds)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const client = await this.getClient();
    if (!client || !isRedisReady()) {
      return false;
    }

    try {
      const cacheKey = this.getCacheKey(key);
      const serialized = JSON.stringify(value);
      const cacheTtl = ttl || this.defaultTtl;

      await client.setEx(cacheKey, cacheTtl, serialized);

      this.stats.sets++;

      if (this.debug) {
        logger.debug('Cache set', { key: cacheKey, ttl: cacheTtl });
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error', error, { key });
      return false;
    }
  }

  /**
   * Delete value from cache
   *
   * @param key - cache key
   */
  async delete(key: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client || !isRedisReady()) {
      return false;
    }

    try {
      const cacheKey = this.getCacheKey(key);
      await client.del(cacheKey);

      this.stats.deletes++;

      if (this.debug) {
        logger.debug('Cache delete', { key: cacheKey });
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error', error, { key });
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   *
   * @param pattern - key pattern (e.g., "order:*")
   */
  async deletePattern(pattern: string): Promise<number> {
    const client = await this.getClient();
    if (!client || !isRedisReady()) {
      return 0;
    }

    try {
      const cachePattern = this.getCacheKey(pattern);
      const keys = await client.keys(cachePattern);

      if (keys.length === 0) {
        return 0;
      }

      await client.del(keys);
      this.stats.deletes += keys.length;

      if (this.debug) {
        logger.debug('Cache pattern delete', { pattern: cachePattern, count: keys.length });
      }

      return keys.length;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache pattern delete error', error, { pattern });
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   *
   * @param key - cache key
   */
  async has(key: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client || !isRedisReady()) {
      return false;
    }

    try {
      const cacheKey = this.getCacheKey(key);
      const exists = await client.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      logger.error('Cache exists check error', error, { key });
      return false;
    }
  }

  /**
   * Get or set value (cache-aside pattern)
   *
   * @param key - cache key
   * @param fetcher - function to fetch value if not in cache
   * @param ttl - optional TTL override
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch from source
    const value = await fetcher();

    // Store in cache (async, don't wait)
    this.set(key, value, ttl).catch((error) => {
      logger.warn('Failed to cache value', { key, error });
    });

    return value;
  }

  /**
   * Invalidate cache for multiple related keys
   *
   * @param keys - array of cache keys to invalidate
   */
  async invalidate(keys: string[]): Promise<void> {
    const client = await this.getClient();
    if (!client || !isRedisReady()) {
      return;
    }

    try {
      const cacheKeys = keys.map((k) => this.getCacheKey(k));
      if (cacheKeys.length > 0) {
        await client.del(cacheKeys);
        this.stats.deletes += cacheKeys.length;

        if (this.debug) {
          logger.debug('Cache invalidation', { keys: cacheKeys });
        }
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache invalidation error', error, { keys });
    }
  }

  /**
   * Clear all cache entries with this prefix
   */
  async clear(): Promise<void> {
    const client = await this.getClient();
    if (!client || !isRedisReady()) {
      return;
    }

    try {
      const pattern = `${this.prefix}:*`;
      const keys = await client.keys(pattern);

      if (keys.length > 0) {
        await client.del(keys);
        this.stats.deletes += keys.length;
        logger.info('Cache cleared', { prefix: this.prefix, count: keys.length });
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clear error', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Get TTL for a cached key
   *
   * @param key - cache key
   * @returns TTL in seconds, or -1 if key doesn't exist
   */
  async getTtl(key: string): Promise<number> {
    const client = await this.getClient();
    if (!client || !isRedisReady()) {
      return -1;
    }

    try {
      const cacheKey = this.getCacheKey(key);
      return await client.ttl(cacheKey);
    } catch (error) {
      logger.error('Cache TTL error', error, { key });
      return -1;
    }
  }

  /**
   * Extend TTL for a cached key
   *
   * @param key - cache key
   * @param ttl - new TTL in seconds
   */
  async extend(key: string, ttl: number): Promise<boolean> {
    const client = await this.getClient();
    if (!client || !isRedisReady()) {
      return false;
    }

    try {
      const cacheKey = this.getCacheKey(key);
      await client.expire(cacheKey, ttl);

      if (this.debug) {
        logger.debug('Cache TTL extended', { key: cacheKey, ttl });
      }

      return true;
    } catch (error) {
      logger.error('Cache extend error', error, { key, ttl });
      return false;
    }
  }
}

/**
 * Create a cache manager instance with specific configuration
 *
 * @param options - cache configuration options
 * @returns cache manager instance
 */
export function createCacheManager(options?: CacheOptions): CacheManager {
  return new CacheManager(options);
}

/**
 * Default cache manager instance for general use
 */
export const defaultCache = createCacheManager({
  prefix: 'app',
  ttl: 300, // 5 minutes
});

/**
 * Cache manager for database queries
 */
export const queryCache = createCacheManager({
  prefix: 'query',
  ttl: 180, // 3 minutes
});

/**
 * Cache manager for API responses
 */
export const apiCache = createCacheManager({
  prefix: 'api',
  ttl: 60, // 1 minute
});

/**
 * Cache manager for user sessions
 */
export const sessionCache = createCacheManager({
  prefix: 'session',
  ttl: 3600, // 1 hour
});
