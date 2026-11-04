/**
 * Idempotency Key Middleware
 *
 * Prevents duplicate processing of requests by tracking idempotency keys.
 * Clients can send an `Idempotency-Key` header to ensure operations are processed exactly once.
 *
 * Flow:
 * 1. Client sends request with `Idempotency-Key: <uuid>` header
 * 2. Server checks if key exists in cache/database
 * 3. If exists: return cached response
 * 4. If not: process request, store response with key
 *
 * Keys expire after 24 hours.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

interface IdempotencyRecord {
  key: string;
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  createdAt: Date;
}

/**
 * Store idempotency record in Redis (preferred) or PostgreSQL (fallback)
 */
async function storeIdempotencyRecord(
  key: string,
  statusCode: number,
  headers: Record<string, string>,
  body: any
): Promise<void> {
  const record: IdempotencyRecord = {
    key,
    statusCode,
    headers,
    body,
    createdAt: new Date(),
  };

  try {
    // Try Redis first (faster)
    if (redis) {
      const redisKey = `idempotency:${key}`;
      await redis.setEx(redisKey, IDEMPOTENCY_TTL_SECONDS, JSON.stringify(record));
      logger.debug('Stored idempotency key in Redis', { key: redisKey });
      return;
    }
  } catch (error) {
    logger.warn('Failed to store idempotency key in Redis, falling back to DB', { error });
  }

  // Fallback to PostgreSQL
  try {
    await prisma.idempotencyKey.create({
      data: {
        key,
        statusCode,
        headers: JSON.stringify(headers),
        body: JSON.stringify(body),
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000),
      },
    });
    logger.debug('Stored idempotency key in database', { key });
  } catch (error) {
    logger.error('Failed to store idempotency key', { key, error });
  }
}

/**
 * Retrieve idempotency record from Redis or PostgreSQL
 */
async function getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
  try {
    // Try Redis first
    if (redis) {
      const redisKey = `idempotency:${key}`;
      const cached = await redis.get(redisKey);
      if (cached) {
        logger.debug('Found idempotency key in Redis', { key: redisKey });
        return JSON.parse(cached) as IdempotencyRecord;
      }
    }
  } catch (error) {
    logger.warn('Failed to retrieve idempotency key from Redis', { error });
  }

  // Fallback to PostgreSQL
  try {
    const record = await prisma.idempotencyKey.findFirst({
      where: { key },
    });

    if (!record) return null;

    // Check if expired
    if (record.expiresAt && record.expiresAt < new Date()) {
      // Delete expired record
      await prisma.idempotencyKey.delete({ where: { id: record.id } }).catch(() => {});
      return null;
    }

    return {
      key: record.key,
      statusCode: record.statusCode,
      headers: JSON.parse(record.headers || '{}'),
      body: JSON.parse(record.body || 'null'),
      createdAt: record.createdAt,
    };
  } catch (error) {
    logger.error('Failed to retrieve idempotency key from database', { key, error });
    return null;
  }
}

/**
 * Idempotency middleware for API routes
 *
 * Usage:
 * ```typescript
 * export const POST = withIdempotency(
 *   async (req: NextRequest) => {
 *     // Your handler logic
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
export function withIdempotency<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    // Only apply to mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return handler(req, ...args);
    }

    const idempotencyKey = req.headers.get('idempotency-key');

    // If no idempotency key provided, process normally
    if (!idempotencyKey) {
      logger.debug('No idempotency key provided, processing request normally');
      return handler(req, ...args);
    }

    // Validate idempotency key format (should be UUID or similar)
    if (!/^[a-zA-Z0-9-_]{8,128}$/.test(idempotencyKey)) {
      logger.warn('Invalid idempotency key format', { key: idempotencyKey });
      return NextResponse.json(
        {
          error: 'invalid_idempotency_key',
          message: 'Idempotency key must be 8-128 alphanumeric characters, hyphens, or underscores',
        },
        { status: 400 }
      );
    }

    // Check if we've already processed this request
    const existingRecord = await getIdempotencyRecord(idempotencyKey);

    if (existingRecord) {
      logger.info('Idempotency key found, returning cached response', {
        key: idempotencyKey,
        statusCode: existingRecord.statusCode,
        age: Date.now() - existingRecord.createdAt.getTime(),
      });

      return new NextResponse(JSON.stringify(existingRecord.body), {
        status: existingRecord.statusCode,
        headers: {
          ...existingRecord.headers,
          'X-Idempotent-Replay': 'true',
          'Content-Type': 'application/json',
        },
      });
    }

    // Process the request
    logger.debug('Processing new request with idempotency key', { key: idempotencyKey });
    const response = await handler(req, ...args);

    // Store the response for future requests with the same key
    try {
      const body = await response.clone().json();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      await storeIdempotencyRecord(idempotencyKey, response.status, headers, body);
    } catch (error) {
      logger.error('Failed to store idempotency record', { key: idempotencyKey, error });
      // Don't fail the request if we can't store the idempotency record
    }

    return response;
  };
}

/**
 * Clean up expired idempotency keys from database
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    const result = await prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    logger.info('Cleaned up expired idempotency keys', { count: result.count });
    return result.count;
  } catch (error) {
    logger.error('Failed to cleanup expired idempotency keys', { error });
    return 0;
  }
}
