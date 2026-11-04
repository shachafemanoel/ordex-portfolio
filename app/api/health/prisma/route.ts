import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { checkDatabaseConnection, getConnectionMetrics } = await import('@/lib/db');
    const healthCheck = await checkDatabaseConnection();
    const metrics = getConnectionMetrics();

    return NextResponse.json({
      status: healthCheck.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        healthy: healthCheck.healthy,
        message: healthCheck.message,
        latency: healthCheck.latency,
      },
      metrics: {
        circuitBreakerState: metrics.circuitBreakerState,
        connectionPool: metrics.connectionPool,
        totalQueries: metrics.totalQueries,
        failedQueries: metrics.failedQueries,
        avgResponseTime: metrics.avgResponseTime,
        lastSuccess: metrics.lastSuccess,
      },
    }, {
      status: healthCheck.healthy ? 200 : 503,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, {
      status: 503,
    });
  }
}
