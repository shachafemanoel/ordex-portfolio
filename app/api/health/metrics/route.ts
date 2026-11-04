import { NextRequest } from 'next/server';
import { getConnectionMetrics } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Performance metrics endpoint with enhanced database monitoring
export async function GET(_: NextRequest) {
  try {
    const dbMetrics = getConnectionMetrics();

    return Response.json({
      success: true,
      data: {
        database: {
          ...dbMetrics,
          uptime: process.uptime(),
          connectionPoolStatus: 'active', // Could be extended with actual pool stats
        },
        system: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          cpuUsage: process.cpuUsage(),
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          env: process.env.NODE_ENV,
        },
        application: {
          name: 'Ordex OMS',
          version: process.env.npm_package_version || 'unknown',
          nodeVersion: process.version,
        },
        timestamp: new Date(),
      },
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Metrics collection failed:', error);
    }

    return Response.json(
      {
        success: false,
        error: {
          message: 'Metrics collection failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}
