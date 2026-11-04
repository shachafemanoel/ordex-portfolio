import { NextResponse } from 'next/server';

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';

export async function GET() {
  // Build phase guard: prevent DB connection attempts during static analysis
  const isBuildPhase =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.DOCKER_BUILD === 'true' ||
    process.env.SKIP_DB_ON_BUILD === 'true';

  if (isBuildPhase) {
    return NextResponse.json({
      ok: true,
      ts: Date.now(),
      status: 'ok',
      version: APP_VERSION,
      build: true,
      db: 'skipped'
    });
  }

  // Runtime environment check (for diagnostics, development only)
  // Logs presence of key variables without exposing values
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Health Check] Environment Status:', JSON.stringify({
      databaseUrl: !!process.env.DATABASE_URL,
      geminiApiKey: !!process.env.GEMINI_API_KEY,
      redisUrl: !!process.env.REDIS_URL || !!process.env.REDIS_PUBLIC_URL
    }));
  }

  try {
    // Dynamic import to avoid top-level side effects during build.
    // This imports lib/prisma-lite which imports lib/db which initializes the client.
    // By doing this inside the handler (and inside the build guard),
    // we ensure no DB initialization happens during 'Collecting page data'.
    const { checkDatabaseConnection } = await import('@/lib/db');
    const health = await checkDatabaseConnection();
    if (!health.healthy) throw new Error('Database not ready');

    return NextResponse.json({
      ok: true,
      ts: Date.now(),
      status: 'ok',
      version: APP_VERSION,
      uptimeSeconds: Math.floor(process.uptime()),
      db: 'ok',
    });
  } catch (error) {
    console.error('[Health Check] DB Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        version: APP_VERSION,
        uptimeSeconds: Math.floor(process.uptime()),
        db: 'error',
        error: 'dependency_unavailable',
      },
      { status: 503 },
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
