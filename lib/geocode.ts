import { fetchMapboxJson, getMapboxAccessToken } from '@/lib/mapbox/server';

/**
 * Geocoding health check utilities — uses shared Mapbox server helpers.
 */

export interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  error?: string;
}

/**
 * Checks if Mapbox Geocoding API is accessible (Geocoding v5 Places API).
 */
export async function checkMapboxHealth(): Promise<HealthCheckResult> {
  if (!getMapboxAccessToken()) {
    return {
      healthy: false,
      message: 'Mapbox token not configured',
    };
  }

  try {
    const testAddress = encodeURIComponent('Tel Aviv, Israel');
    const path = `/geocoding/v5/mapbox.places/${testAddress}.json?limit=1`;
    const data = await fetchMapboxJson<{ features?: unknown[] }>(path);

    if (!data) {
      return {
        healthy: false,
        error: 'API request failed or returned invalid JSON',
      };
    }

    if (data.features?.length) {
      return {
        healthy: true,
        message: 'Mapbox Geocoding API is accessible',
      };
    }

    return {
      healthy: false,
      error: 'API returned no results',
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error during health check',
    };
  }
}
