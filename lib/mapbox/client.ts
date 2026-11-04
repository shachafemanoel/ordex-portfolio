/**
 * Client-safe Mapbox helpers. Only `NEXT_PUBLIC_MAPBOX_TOKEN` is available in the
 * browser bundle; never read `MAPBOX` here (it would not ship to the client).
 */
export const getMapboxPublicToken = () => (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();

export const hasMapboxToken = () => Boolean(getMapboxPublicToken());
