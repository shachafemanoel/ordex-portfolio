import { getCacheService } from '@/lib/cache/CacheService';
import { invalidateOrderCache } from '@/lib/cache/orderCache';

export async function invalidateOrderReadModels(orderId: string): Promise<void> {
  const cache = getCacheService();

  await Promise.allSettled([
    cache.invalidate(`Order:${orderId}*`),
    cache.invalidate('Order:list:*'),
    invalidateOrderCache(orderId),
  ]);
}
