import { ApiError } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { requireStoreAdmin } from './import';
import { MAX_ATTEMPTS } from './jobs';

export async function listJobs(page = 1) {
  await requireStoreAdmin();
  const [jobs, counts, lastSeen, oldest, total] = await Promise.all([
    prisma.wooSyncJob.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 30,
      take: 30,
      select: {
        id: true,
        kind: true,
        objectId: true,
        parentId: true,
        state: true,
        attempts: true,
        lastErrorCode: true,
        createdAt: true,
        completedAt: true,
        availableAt: true,
        progress: true,
      },
    }),
    prisma.wooSyncJob.groupBy({ by: ['state'], _count: true }),
    prisma.workerHeartbeat.aggregate({ _max: { lastSeenAt: true } }),
    prisma.wooSyncJob.aggregate({
      where: { state: { in: ['PENDING', 'RUNNING'] } },
      _min: { createdAt: true },
    }),
    prisma.wooSyncJob.count(),
  ]);
  return {
    jobs,
    counts: Object.fromEntries(counts.map((c) => [c.state, c._count])),
    page,
    hasNext: page * 30 < total,
    workerLastSeenAt: lastSeen._max.lastSeenAt,
    workerStale:
      !lastSeen._max.lastSeenAt || Date.now() - lastSeen._max.lastSeenAt.getTime() > 120000,
    waitingTooLong: Boolean(
      oldest._min.createdAt && Date.now() - oldest._min.createdAt.getTime() > 300000
    ),
  };
}
export async function retryJob(id: string) {
  const actor = await requireStoreAdmin();
  return prisma.$transaction(async (tx) => {
    const jobs = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM woo_sync_jobs WHERE id=${id}::uuid FOR UPDATE`;
    if (!jobs.length) throw new ApiError('NOT_FOUND', 'העבודה לא נמצאה', 404);
    const job = await tx.wooSyncJob.findUniqueOrThrow({ where: { id } });
    if (!['FAILED', 'NEEDS_ATTENTION'].includes(job.state) || job.attempts >= MAX_ATTEMPTS)
      throw new ApiError(
        'RETRY_UNAVAILABLE',
        'מוצו הניסיונות או שהעבודה אינה ממתינה לניסיון חוזר. עדכון מקור חדש ייצור עבודה חדשה',
        409
      );
    const prior = (job.progress ?? {}) as Record<string, string | number>;
    await tx.wooSyncJob.update({
      where: { id },
      data: {
        state: 'PENDING',
        availableAt: new Date(),
        lockedBy: null,
        lockedUntil: null,
        completedAt: null,
        progress: { ...prior, retriedBy: actor.userId, retriedAt: new Date().toISOString() },
        lastErrorCode: null,
      },
    });
    return { jobId: id };
  });
}
