import { getRedisClient } from '@/lib/redis';
import { NextResponse } from 'next/server';

const LAST_JOB_KEY = 'ordex:worker:reminders:lastJobAt';
const FAILED_LAST_HOUR_KEY = 'ordex:worker:reminders:failedJobsLastHour';

export async function GET() {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      throw new Error('Redis unavailable');
    }

    await redis.ping();
    const [lastJobAtRaw, failedRaw] = await Promise.all([
      redis.get(LAST_JOB_KEY),
      redis.get(FAILED_LAST_HOUR_KEY),
    ]);

    return NextResponse.json({
      status: 'ok',
      queue: 'ok',
      lastJobAt: lastJobAtRaw ?? null,
      failedJobsLastHour: Number(failedRaw ?? 0),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        queue: 'error',
        lastJobAt: null,
        failedJobsLastHour: 0,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
