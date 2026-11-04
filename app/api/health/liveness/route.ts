import { NextRequest } from 'next/server';
import { healthMonitor } from '@/lib/health-monitor';

export const dynamic = 'force-dynamic';

// Kubernetes liveness probe endpoint
export async function GET(_: NextRequest) {
  if (process.env.DOCKER_BUILD === 'true') {
    return Response.json({ status: 'alive', uptime: 0, timestamp: new Date() }, { status: 200 });
  }
  try {
    const liveness = await healthMonitor.checkLiveness();

    return Response.json(
      {
        status: liveness.alive ? 'alive' : 'dead',
        uptime: liveness.uptime,
        timestamp: new Date(),
      },
      { status: liveness.alive ? 200 : 503 }
    );
  } catch (error) {
    console.error('Liveness check failed:', error);

    return Response.json(
      {
        status: 'dead',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      },
      { status: 503 }
    );
  }
}
