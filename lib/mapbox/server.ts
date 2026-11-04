/**
 * Server-only Mapbox API helpers: single place for token resolution, base URL,
 * and HTTP calls. Prefer MAPBOX (secret) for server; fall back to NEXT_PUBLIC_MAPBOX_TOKEN.
 */

export const MAPBOX_API_ORIGIN = 'https://api.mapbox.com';

/** Bounding box for Israel (west,south,east,north) — used to bias geocoding. */
export const ISRAEL_BBOX = '34.2,29.4,35.9,33.4';

const DEFAULT_STYLE_ID = 'mapbox/streets-v12';

const DEFAULT_GEOCODE_TYPES = 'address,street,place';

export function getMapboxAccessToken(): string {
  return (process.env.MAPBOX || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
}

export function hasMapboxAccessToken(): boolean {
  return Boolean(getMapboxAccessToken());
}

export function getMapboxStyleId(): string {
  const raw = (process.env.MAPBOX_STYLE_ID || DEFAULT_STYLE_ID).trim();
  return raw || DEFAULT_STYLE_ID;
}

export type GeocodeV6ForwardOptions = {
  q: string;
  autocomplete: boolean;
  limit: number;
  /** ISO 3166-1 alpha-2 */
  country: string;
  language?: string;
  bbox?: string;
  types?: string;
};

/**
 * Path + query for Search Box Geocoding v6 forward (no host, no token).
 */
export function buildGeocodeV6ForwardPath(options: GeocodeV6ForwardOptions): string {
  const params = new URLSearchParams({
    q: options.q,
    autocomplete: String(options.autocomplete),
    limit: String(options.limit),
    types: options.types ?? DEFAULT_GEOCODE_TYPES,
    language: options.language ?? 'he',
    country: options.country.toLowerCase(),
  });
  if (options.bbox) {
    params.set('bbox', options.bbox);
  }
  return `/search/geocode/v6/forward?${params.toString()}`;
}

function mapboxUrl(pathWithQuery: string, accessToken: string): string {
  const sep = pathWithQuery.includes('?') ? '&' : '?';
  return `${MAPBOX_API_ORIGIN}${pathWithQuery}${sep}access_token=${encodeURIComponent(accessToken)}`;
}

/**
 * GET JSON from Mapbox API. Returns null if no token, non-OK response, or parse failure.
 */
export async function fetchMapboxJson<T>(
  pathWithQuery: string,
  init?: RequestInit
): Promise<T | null> {
  const token = getMapboxAccessToken();
  if (!token) {
    return null;
  }

  const url = mapboxUrl(pathWithQuery, token);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    ...init,
  });

  if (!response.ok) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
