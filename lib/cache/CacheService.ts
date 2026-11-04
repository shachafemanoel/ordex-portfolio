import { getRedisClient, isRedisReady } from '@/lib/redis';

export interface CacheService {
  isAvailable(): boolean;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

export class RedisCacheService implements CacheService {
  isAvailable(): boolean {
    return isRedisReady();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      if (!client) return null;

      const value = await client.get(key);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      const client = await getRedisClient();
      if (!client) return;

      const serialized = JSON.stringify(value);
      await client.set(key, serialized, { EX: ttlSeconds });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const client = await getRedisClient();
      if (!client) return;

      await client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const client = await getRedisClient();
      if (!client) return;

      // Use SCAN to find keys matching pattern
      const keys: string[] = [];
      let cursor = 0;

      do {
        const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);

      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }
}

export class InMemoryCacheService implements CacheService {
  isAvailable(): boolean {
    return false;
  }

  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set(_key: string, _value: any, _ttlSeconds?: number): Promise<void> {
    // No-op
  }

  async delete(_key: string): Promise<void> {
    // No-op
  }

  async invalidate(_pattern: string): Promise<void> {
    // No-op
  }
}

export function createCacheService(): CacheService {
  if (isRedisReady()) {
    return new RedisCacheService();
  }
  return new InMemoryCacheService();
}

export const getCacheService = createCacheService;
