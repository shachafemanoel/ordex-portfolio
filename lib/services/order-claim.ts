import { PrismaClient } from '@prisma/client';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check if a claim is stale (older than 30 minutes).
 */
export function isClaimStale(workingStartedAt: Date | null): boolean {
  if (!workingStartedAt) return true;
  return Date.now() - workingStartedAt.getTime() > STALE_THRESHOLD_MS;
}

/**
 * Batch clear stale claims (> 30 min old).
 * Returns count of cleared claims.
 */
export async function clearStaleClaims(prisma: PrismaClient): Promise<number> {
  const threshold = new Date(Date.now() - STALE_THRESHOLD_MS);

  const result = await prisma.order.updateMany({
    where: {
      workingByUserId: { not: null },
      workingStartedAt: { lt: threshold },
    },
    data: {
      workingByUserId: null,
      workingStartedAt: null,
    },
  });

  return result.count;
}
