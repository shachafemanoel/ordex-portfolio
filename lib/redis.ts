/**
 * Enhanced Redis Configuration and Client Setup
 * Primary data store for OrdEx OMS with JSON documents and RediSearch
 */

import { createClient, type RedisClientType } from 'redis';

// Optional, quiet Redis client with backoff to avoid log spam
let client: any = null;
let redis: any = null; // live export binding below
let initializing = false;
let ready = false;
let nextAttemptAt = 0; // epoch ms for backoff

function getUrl(): string | null {
  // Support multiple Redis URL formats
  // 1. REDIS_URL (standard - works for Railway, local, Upstash, etc.)
  // 2. UPSTASH_REDIS_REST_URL (Upstash specific)
  // 3. Build from components (REDISHOST, REDISPORT, etc.) - Railway provides these

  let url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;

  // If no full URL, try building from components (Railway style)
  if (!url && process.env.REDISHOST) {
    const host = process.env.REDISHOST;
    const port = process.env.REDISPORT || '6379';
    const user = process.env.REDISUSER || '';
    const password = process.env.REDISPASSWORD || '';

    // Build redis:// URL
    if (user && password) {
      url = `redis://${user}:${password}@${host}:${port}`;
    } else if (password) {
      url = `redis://:${password}@${host}:${port}`;
    } else {
      url = `redis://${host}:${port}`;
    }
  }

  return url || null;
}

// Redis key helpers
export const keys = {
  // Orders
  order: (id: string) => `order:${id}`,
  orderByWoo: (wooId: number) => `order:by_woo:${wooId}`,
  orderHistory: (id: string) => `order:${id}:history`,

  // SKUs/Products
  sku: (id: string) => `sku:${id}`,
  skuByWoo: (productId: number, variantId?: number) =>
    `sku:by_woo:${productId}${variantId ? `:${variantId}` : ''}`,

  // Customers
  customer: (id: string) => `customer:${id}`,
  customerByWoo: (wooId: number) => `customer:by_woo:${wooId}`,

  // Sync jobs
  syncJob: (id: string) => `syncjob:${id}`,

  // Indexes
  indexes: {
    orders: 'ordex:idx:orders',
    skus: 'ordex:idx:skus',
    customers: 'ordex:idx:customers',
    syncJobs: 'ordex:idx:syncjobs',
  },

  // Streams
  streams: {
    orderEvents: 'ordex:stream:order_events',
    syncEvents: 'ordex:stream:sync_events',
  },
} as const;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (process.env.TENANT_ENFORCEMENT === 'true') return null;
  // Skip during build/CI
  if (
    process.env.DOCKER_BUILD === 'true' ||
    process.env.CI === 'true' ||
    process.env.RAILWAY_BUILD
  ) {
    return null;
  }

  if (ready && client && client.isOpen) return client;
  if (initializing) return null;

  const url = getUrl();
  if (!url) return null; // Optional: no URL configured

  const now = Date.now();
  if (now < nextAttemptAt) return null; // Backoff window

  try {
    initializing = true;

    // Configure client for Render Key-Value service
    const config: any = { url };

    // Render Key-Value free tier doesn't require authentication
    // Only add auth if explicitly present in URL
    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.password && !parsedUrl.username) {
        // No auth in URL - don't force authentication for Render free tier
        config.socket = {
          connectTimeout: 10000,
          family: 0, // Enable dual-stack lookups
        };
      }
    } catch (e) {
      // Keep original URL configuration if parsing fails
    }

    const c = createClient(config);
    c.on('error', () => {
      // quiet: just mark as not ready
      ready = false;
    });
    await c.connect();
    client = c;
    redis = c; // update live export
    ready = true;
    nextAttemptAt = 0;
    return client;
  } catch {
    // Connection failed: set short backoff then longer
    ready = false;
    client = null;
    redis = null; // update live export
    nextAttemptAt = Date.now() + 30000; // 30s backoff to avoid ENOTFOUND spam
    return null;
  } finally {
    initializing = false;
  }
}

export function isRedisReady(): boolean {
  if (process.env.TENANT_ENFORCEMENT === 'true') return false;
  return !!(ready && client && client.isOpen);
}

// Initialize RediSearch indexes (compatible with existing implementation)
export async function initializeIndexes() {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    // Use sendCommand for broader compatibility
    await client.sendCommand([
      'FT.CREATE',
      'ordex:idx:orders',
      'ON',
      'JSON',
      'PREFIX',
      '1',
      'ordex:order:',
      'SCHEMA',
      '$.number',
      'AS',
      'number',
      'TAG',
      '$.status',
      'AS',
      'status',
      'TAG',
      '$.source',
      'AS',
      'source',
      'TAG',
      '$.customerId',
      'AS',
      'customerId',
      'TAG',
      '$.customer.name',
      'AS',
      'customerName',
      'TEXT',
      '$.customer.phone',
      'AS',
      'customerPhone',
      'TAG',
      '$.shippingAddress.city',
      'AS',
      'city',
      'TAG',
      '$.assignedUserId',
      'AS',
      'assignedUserId',
      'TAG',
      '$.createdAt',
      'AS',
      'createdAt',
      'TAG',
      'SORTABLE',
      '$.totalAmountCents',
      'AS',
      'amountCents',
      'NUMERIC',
      '$.totalAmount',
      'AS',
      'amount',
      'NUMERIC',
      '$.wooOrderId',
      'AS',
      'wooOrderId',
      'NUMERIC',
    ]);

    await client.sendCommand([
      'FT.CREATE',
      'ordex:idx:skus',
      'ON',
      'JSON',
      'PREFIX',
      '1',
      'ordex:sku:',
      'SCHEMA',
      '$.skuCode',
      'AS',
      'skuCode',
      'TAG',
      '$.name',
      'AS',
      'name',
      'TEXT',
      '$.categories[*]',
      'AS',
      'category',
      'TAG',
      '$.active',
      'AS',
      'active',
      'TAG',
      '$.unitPrice',
      'AS',
      'unitPrice',
      'NUMERIC',
      '$.stockQty',
      'AS',
      'stockQty',
      'NUMERIC',
      '$.wooProductId',
      'AS',
      'wooProductId',
      'NUMERIC',
      '$.wooVariantId',
      'AS',
      'wooVariantId',
      'NUMERIC',
      '$.updatedAt',
      'AS',
      'updatedAt',
      'TAG',
    ]);

    console.log('✅ RediSearch indexes initialized');
    return true;
  } catch (error: any) {
    // Ignore if indexes already exist
    if (error.message?.includes('Index already exists')) {
      console.log('✅ RediSearch indexes already exist');
      return true;
    }
    console.error('❌ Failed to initialize RediSearch indexes:', error);
    return false;
  }
}

// Health check for Redis
export async function getRedisHealth() {
  try {
    const client = await getRedisClient();
    if (!client) return { status: 'unavailable', connected: false };

    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;

    const info = await client.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);

    return {
      status: 'healthy',
      latency_ms: latency,
      memory_used_bytes: memoryMatch ? parseInt(memoryMatch[1]) : null,
      connected: true,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: String(error),
      connected: false,
    };
  }
}

// Keep legacy exports for compatibility
export { redis };
export const redisConnection = Promise.resolve(redis as any);
