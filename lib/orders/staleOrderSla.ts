import type { Prisma, PrismaClient } from '@prisma/client';
import { addHours } from 'date-fns';

/** Same horizon as smart notifications “stale order” (createdAt older than this). */
export const STALE_ORDER_SLA_HOURS = 48;

export function staleOrderSlaWhere(now: Date = new Date()): Prisma.OrderWhereInput {
  return {
    createdAt: { lt: addHours(now, -STALE_ORDER_SLA_HOURS) },
    deletedAt: null,
    completedAt: null,
  };
}

export type StaleOrderSlaSample = {
  id: string;
  number: string;
  createdAt: Date;
};

/**
 * Count + oldest sample for digests / push (aligned with buildSmartNotifications stale list).
 */
export async function fetchStaleOrdersSlaSummary(
  db: Pick<PrismaClient, 'order'>,
  now: Date = new Date()
): Promise<{ count: number; oldest: StaleOrderSlaSample | null }> {
  const where = staleOrderSlaWhere(now);
  const [count, samples] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      select: { id: true, number: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 1,
    }),
  ]);
  return { count, oldest: samples[0] ?? null };
}
