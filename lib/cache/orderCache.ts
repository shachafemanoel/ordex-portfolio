/**
 * Order Cache Layer
 *
 * Provides Redis caching for order detail data to reduce database load
 * and improve response times on the order detail page.
 *
 * Features:
 * - Automatic cache invalidation on updates
 * - TTL-based expiration
 * - Graceful fallback to database when cache unavailable
 * - Parallel data fetching optimization
 */

import { getRedisClient, keys } from '@/lib/redis';

// Cache TTL values in seconds
const CACHE_TTL = {
  ORDER_DETAIL: 300,      // 5 minutes - full order with workflow
  ORDER_TIMELINE: 600,    // 10 minutes - status history
  ORDER_MESSAGES: 300,    // 5 minutes - message logs
  PURCHASE_ORDERS: 300,   // 5 minutes - linked POs
} as const;

// Cache key generators
export const orderCacheKeys = {
  detail: (orderId: string) => `order:detail:${orderId}`,
  timeline: (orderId: string) => `order:timeline:${orderId}`,
  messages: (orderId: string) => `order:messages:${orderId}`,
  purchaseOrders: (orderId: string) => `order:pos:${orderId}`,
  workflow: (orderId: string) => `order:workflow:${orderId}`,
} as const;

/**
 * Get cached order detail data
 */
export async function getCachedOrderDetail<T>(orderId: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const cached = await client.get(orderCacheKeys.detail(orderId));
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    console.warn(`[OrderCache] Failed to get cached order detail for ${orderId}:`, error);
    return null;
  }
}

/**
 * Set cached order detail data
 */
export async function setCachedOrderDetail<T>(orderId: string, data: T): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.setEx(
      orderCacheKeys.detail(orderId),
      CACHE_TTL.ORDER_DETAIL,
      JSON.stringify(data)
    );
  } catch (error) {
    console.warn(`[OrderCache] Failed to cache order detail for ${orderId}:`, error);
  }
}

/**
 * Get cached timeline data
 */
export async function getCachedTimeline<T>(orderId: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const cached = await client.get(orderCacheKeys.timeline(orderId));
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    console.warn(`[OrderCache] Failed to get cached timeline for ${orderId}:`, error);
    return null;
  }
}

/**
 * Set cached timeline data
 */
export async function setCachedTimeline<T>(orderId: string, data: T): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.setEx(
      orderCacheKeys.timeline(orderId),
      CACHE_TTL.ORDER_TIMELINE,
      JSON.stringify(data)
    );
  } catch (error) {
    console.warn(`[OrderCache] Failed to cache timeline for ${orderId}:`, error);
  }
}

/**
 * Get cached purchase orders
 */
export async function getCachedPurchaseOrders<T>(orderId: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const cached = await client.get(orderCacheKeys.purchaseOrders(orderId));
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    console.warn(`[OrderCache] Failed to get cached purchase orders for ${orderId}:`, error);
    return null;
  }
}

/**
 * Set cached purchase orders
 */
export async function setCachedPurchaseOrders<T>(orderId: string, data: T): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.setEx(
      orderCacheKeys.purchaseOrders(orderId),
      CACHE_TTL.PURCHASE_ORDERS,
      JSON.stringify(data)
    );
  } catch (error) {
    console.warn(`[OrderCache] Failed to cache purchase orders for ${orderId}:`, error);
  }
}

/**
 * Invalidate all cached data for an order
 */
export async function invalidateOrderCache(orderId: string): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    const keysToDelete = [
      orderCacheKeys.detail(orderId),
      orderCacheKeys.timeline(orderId),
      orderCacheKeys.messages(orderId),
      orderCacheKeys.purchaseOrders(orderId),
      orderCacheKeys.workflow(orderId),
    ];

    await client.del(keysToDelete);
    console.log(`[OrderCache] Invalidated cache for order ${orderId}`);
  } catch (error) {
    console.warn(`[OrderCache] Failed to invalidate cache for ${orderId}:`, error);
  }
}

/**
 * Get multiple cached items in parallel
 */
export async function getMultipleCached<T>(keys: string[]): Promise<(T | null)[]> {
  try {
    const client = await getRedisClient();
    if (!client) return keys.map(() => null);

    const values = await client.mGet(keys);
    return values.map((value) => {
      if (value) {
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      }
      return null;
    });
  } catch (error) {
    console.warn(`[OrderCache] Failed to get multiple cached items:`, error);
    return keys.map(() => null);
  }
}

/**
 * Set multiple cached items in parallel
 */
export async function setMultipleCached<T>(
  items: Array<{ key: string; value: T; ttl: number }>
): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    const pipeline = client.multi();
    for (const item of items) {
      pipeline.setEx(item.key, item.ttl, JSON.stringify(item.value));
    }
    await pipeline.exec();
  } catch (error) {
    console.warn(`[OrderCache] Failed to set multiple cached items:`, error);
  }
}

/**
 * Check if Redis caching is available
 */
export async function isCacheAvailable(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    return client !== null;
  } catch {
    return false;
  }
}

export { CACHE_TTL };
