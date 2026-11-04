import { NextRequest } from 'next/server';
import { AppStartup } from '@/lib/app-startup';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest) {
  if (process.env.DOCKER_BUILD === 'true') {
    return Response.json({ success: true, data: { ready: true, reason: 'docker-build' } }, { status: 200 });
  }
  try {
    const startupHealth = await AppStartup.checkStartupHealth();

    return Response.json(
      {
        success: true,
        data: startupHealth,
        timestamp: new Date(),
      },
      {
        status: startupHealth.ready ? 200 : 503,
      }
    );
  } catch (error) {
    console.error('Startup health check failed:', error);

    return Response.json(
      {
        success: false,
        error: {
          message: 'Startup health check failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}

// POST endpoint to force reinitialization (useful for development/troubleshooting)
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json().catch(() => ({}));

    if (action === 'reset') {
      AppStartup.reset();
      return Response.json({
        success: true,
        message: 'Application startup reset successfully',
        timestamp: new Date(),
      });
    }

    if (action === 'reinitialize') {
      const result = await AppStartup.initialize();
      return Response.json(
        {
          success: result.success,
          data: result,
          timestamp: new Date(),
        },
        {
          status: result.success ? 200 : 500,
        }
      );
    }

    return Response.json(
      {
        success: false,
        error: {
          message: 'Invalid action. Use "reset" or "reinitialize"',
        },
        timestamp: new Date(),
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Startup action failed:', error);

    return Response.json(
      {
        success: false,
        error: {
          message: 'Startup action failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}
