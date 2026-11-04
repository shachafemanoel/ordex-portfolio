/**
 * Cache Module - Comprehensive caching infrastructure
 *
 * Exports cache services, managers, and repository decorators
 */

// Legacy Cache Service (preserved for backward compatibility)
export {
  createCacheService,
  getCacheService,
  RedisCacheService,
  InMemoryCacheService,
} from './CacheService';

export type { CacheService } from '@/lib/cache/CacheService';

// Phase 1: Modern Cache Infrastructure
export {
  CacheManager,
  CacheStrategy,
  createCacheManager,
  defaultCache,
  queryCache,
  apiCache,
  sessionCache,
  type CacheOptions,
  type CacheStats,
} from './cache-manager';

export {
  CachedRepository,
  DefaultCacheKeyStrategy,
  createCachedRepository,
  withCache,
  Cached,
  InvalidateCache,
  type ICacheable,
  type IRepository,
  type CacheKeyStrategy,
} from './cached-repository';
