/**
 * Cached Repository Decorator
 *
 * Provides caching layer for repository patterns with automatic
 * cache invalidation and various caching strategies.
 *
 * @module lib/cache/cached-repository
 */

import { CacheManager, CacheStrategy } from '@/lib/cache/cache-manager';
import { logger } from '@/lib/logger';

/**
 * Base repository interface that can be cached
 */
export interface ICacheable<T> {
  /**
   * Unique identifier for the entity
   */
  id: string;
}

/**
 * Repository interface with standard CRUD operations
 */
export interface IRepository<T extends ICacheable<T>> {
  findById(id: string): Promise<T | null>;
  findMany(filter?: any): Promise<T[]>;
  create(data: any): Promise<T>;
  update(id: string, data: any): Promise<T>;
  delete(id: string): Promise<void>;
}

/**
 * Cache key generation strategies
 */
export interface CacheKeyStrategy {
  /**
   * Generate key for single entity
   */
  single(id: string): string;

  /**
   * Generate key for list queries
   */
  list(filter?: any): string;

  /**
   * Generate invalidation pattern
   */
  pattern(): string;
}

/**
 * Default cache key strategy
 */
export class DefaultCacheKeyStrategy implements CacheKeyStrategy {
  constructor(private entityName: string) {}

  single(id: string): string {
    return `${this.entityName}:${id}`;
  }

  list(filter?: any): string {
    const filterKey = filter ? JSON.stringify(filter) : 'all';
    return `${this.entityName}:list:${filterKey}`;
  }

  pattern(): string {
    return `${this.entityName}:*`;
  }
}

/**
 * Cached Repository Decorator
 *
 * Wraps a repository with caching layer
 */
export class CachedRepository<T extends ICacheable<T>> implements IRepository<T> {
  constructor(
    private repository: IRepository<T>,
    private cache: CacheManager,
    private keyStrategy: CacheKeyStrategy,
    private ttl: number = 300 // 5 minutes default
  ) {}

  /**
   * Find entity by ID with caching
   */
  async findById(id: string): Promise<T | null> {
    const cacheKey = this.keyStrategy.single(id);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        logger.debug('Cache miss - fetching from repository', { entity: cacheKey });
        return await this.repository.findById(id);
      },
      this.ttl
    );
  }

  /**
   * Find many entities with caching
   */
  async findMany(filter?: any): Promise<T[]> {
    const cacheKey = this.keyStrategy.list(filter);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        logger.debug('Cache miss - fetching list from repository', {
          filter,
          cacheKey,
        });
        return await this.repository.findMany(filter);
      },
      this.ttl
    );
  }

  /**
   * Create entity and invalidate cache
   */
  async create(data: any): Promise<T> {
    const entity = await this.repository.create(data);

    // Invalidate list caches
    await this.invalidateListCaches();

    logger.info('Entity created, list caches invalidated', {
      entityId: entity.id,
    });

    return entity;
  }

  /**
   * Update entity and invalidate cache
   */
  async update(id: string, data: any): Promise<T> {
    const entity = await this.repository.update(id, data);

    // Invalidate both single and list caches
    await this.invalidateCaches(id);

    logger.info('Entity updated, caches invalidated', {
      entityId: id,
    });

    return entity;
  }

  /**
   * Delete entity and invalidate cache
   */
  async delete(id: string): Promise<void> {
    await this.repository.delete(id);

    // Invalidate both single and list caches
    await this.invalidateCaches(id);

    logger.info('Entity deleted, caches invalidated', {
      entityId: id,
    });
  }

  /**
   * Invalidate caches for a specific entity
   */
  private async invalidateCaches(id: string): Promise<void> {
    // Invalidate single entity cache
    const singleKey = this.keyStrategy.single(id);
    await this.cache.delete(singleKey);

    // Invalidate all list caches
    await this.invalidateListCaches();
  }

  /**
   * Invalidate all list caches
   */
  private async invalidateListCaches(): Promise<void> {
    const pattern = this.keyStrategy.pattern();
    await this.cache.deletePattern(pattern);
  }

  /**
   * Manually invalidate cache for specific entity
   */
  async invalidate(id: string): Promise<void> {
    await this.invalidateCaches(id);
  }

  /**
   * Manually clear all caches for this repository
   */
  async clearCache(): Promise<void> {
    const pattern = this.keyStrategy.pattern();
    await this.cache.deletePattern(pattern);
    logger.info('Repository cache cleared', { pattern });
  }

  /**
   * Warm up cache by preloading entities
   */
  async warmup(ids: string[]): Promise<void> {
    logger.info('Warming up cache', { entityCount: ids.length });

    for (const id of ids) {
      const cacheKey = this.keyStrategy.single(id);
      const cached = await this.cache.get(cacheKey);

      if (!cached) {
        const entity = await this.repository.findById(id);
        if (entity) {
          await this.cache.set(cacheKey, entity, this.ttl);
        }
      }
    }

    logger.info('Cache warmup completed', { entityCount: ids.length });
  }
}

/**
 * Create a cached repository decorator
 *
 * @param repository - repository to wrap
 * @param cache - cache manager instance
 * @param entityName - name of entity for cache keys
 * @param ttl - optional TTL override
 * @returns cached repository
 */
export function createCachedRepository<T extends ICacheable<T>>(
  repository: IRepository<T>,
  cache: CacheManager,
  entityName: string,
  ttl?: number
): CachedRepository<T> {
  const keyStrategy = new DefaultCacheKeyStrategy(entityName);
  return new CachedRepository(repository, cache, keyStrategy, ttl);
}

/**
 * Cache-aside pattern helper
 *
 * Implements cache-aside pattern for any data fetching operation
 *
 * @param cacheKey - cache key
 * @param fetcher - function to fetch data
 * @param cache - cache manager
 * @param ttl - optional TTL
 */
export async function withCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  cache: CacheManager,
  ttl?: number
): Promise<T> {
  return await cache.getOrSet(cacheKey, fetcher, ttl);
}

/**
 * Decorator for caching method results
 *
 * @param cacheKey - function to generate cache key from arguments
 * @param cache - cache manager
 * @param ttl - optional TTL
 */
export function Cached(
  cacheKey: (...args: any[]) => string,
  cache: CacheManager,
  ttl?: number
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = cacheKey(...args);
      return await cache.getOrSet(key, () => originalMethod.apply(this, args), ttl);
    };

    return descriptor;
  };
}

/**
 * Decorator for invalidating cache on method call
 *
 * @param cacheKeys - function to generate cache keys to invalidate
 * @param cache - cache manager
 */
export function InvalidateCache(
  cacheKeys: (...args: any[]) => string[],
  cache: CacheManager
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      const keys = cacheKeys(...args);
      await cache.invalidate(keys);
      return result;
    };

    return descriptor;
  };
}
