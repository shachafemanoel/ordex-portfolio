export const dynamic = 'force-dynamic';

// Use standard Response to avoid any build-time issues

// Simple health check that doesn't depend on external services
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ordex-oms',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0',
  });
}
