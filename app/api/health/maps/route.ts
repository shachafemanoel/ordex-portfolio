import { checkMapboxHealth } from '@/lib/geocode';
import { hasMapboxAccessToken } from '@/lib/mapbox/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = hasMapboxAccessToken();

  if (!configured) {
    return Response.json({
      configured: false,
      ok: false,
      error: 'No Mapbox token configured (need MAPBOX or NEXT_PUBLIC_MAPBOX_TOKEN)',
    });
  }

  const result = await Promise.race([
    checkMapboxHealth(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
  ]).catch((error: any) => ({ healthy: false, error: error?.message || 'timeout' }));

  return Response.json({
    configured,
    ok: result.healthy,
    error: result.error,
  });
}
