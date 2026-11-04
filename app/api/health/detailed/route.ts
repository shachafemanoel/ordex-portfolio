import { NextRequest } from 'next/server';
import { healthMonitor } from '@/lib/health-monitor';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest) {
  if (process.env.DOCKER_BUILD === 'true') {
    return Response.json(
      {
        success: true,
        data: { status: 'degraded', reason: 'docker-build' },
      },
      { status: 200 }
    );
  }
  try {
    const systemHealth = await healthMonitor.getSystemHealth();

    // Return appropriate HTTP status based on health
    const statusCode =
      systemHealth.status === 'healthy' ? 200 : systemHealth.status === 'degraded' ? 200 : 503;

    return Response.json(
      {
        success: true,
        data: systemHealth,
      },
      { status: statusCode }
    );
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Health check failed:', error);
    }

    return Response.json(
      {
        success: false,
        status: 'unhealthy',
        error: {
          message: 'Health check system failure',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}
