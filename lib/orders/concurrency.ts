import { DomainError } from '@/lib/server/errors';
import { Prisma } from '@prisma/client';

const ORDER_LOCK_NAMESPACE = 'ordex:order-lock';

/**
 * Parses an optimistic version token into a Date.
 * Accepts plain ISO strings and weak ETag style values.
 */
export function parseOrderVersionToken(token: string | null | undefined): Date | null {
  if (!token) return null;

  const normalized = token
    .trim()
    .replace(/^W\//i, '')
    .replace(/^"+|"+$/g, '');

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/**
 * Acquires a transaction-scoped advisory lock for an order.
 * This serializes concurrent mutations on the same order ID.
 */
export async function acquireOrderMutationLock(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  try {
    const lockKey = `${ORDER_LOCK_NAMESPACE}:${orderId}`;
    await tx.$queryRaw<{ acquired: number }[]>`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      )
      SELECT 1 AS acquired
    `;
  } catch (error) {
    // If advisory locks are unavailable, keep running without hard-failing.
    console.warn('[orders-concurrency] advisory lock unavailable', error);
  }
}

/**
 * Ensures the order has not changed since the expected version timestamp.
 * Throws 409 conflict when the order was modified by another writer.
 */
export async function assertOrderVersion(
  tx: Prisma.TransactionClient,
  orderId: string,
  expectedUpdatedAt: Date | null
): Promise<void> {
  if (!expectedUpdatedAt) return;

  const current = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, updatedAt: true },
  });

  if (!current) {
    throw new DomainError('order_not_found', 404, { orderId });
  }

  if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    throw new DomainError('optimistic_lock_conflict', 409, {
      orderId,
      expectedUpdatedAt: expectedUpdatedAt.toISOString(),
      currentUpdatedAt: current.updatedAt.toISOString(),
      message: 'The order was modified by another user. Please refresh and retry.',
    });
  }
}
