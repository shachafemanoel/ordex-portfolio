type LngLatCoordinate = [number, number];

export type StaticMapPoint = {
  lat: number;
  lng: number;
};

const DEFAULT_MAX_PATH_POINTS = 72;

function toFiniteCoordinatePair(value: LngLatCoordinate): LngLatCoordinate | null {
  const [lng, lat] = value;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return [lng, lat];
}

function clampPathCoordinates(
  coordinates: LngLatCoordinate[],
  maxPoints = DEFAULT_MAX_PATH_POINTS
): LngLatCoordinate[] {
  const sanitized = coordinates
    .map((coordinate) => toFiniteCoordinatePair(coordinate))
    .filter((coordinate): coordinate is LngLatCoordinate => coordinate !== null);

  if (sanitized.length <= maxPoints) {
    return sanitized;
  }

  const lastIndex = sanitized.length - 1;
  const step = lastIndex / (maxPoints - 1);
  const reduced: LngLatCoordinate[] = [];

  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = index === maxPoints - 1 ? lastIndex : Math.round(index * step);
    reduced.push(sanitized[sourceIndex]);
  }

  return reduced;
}

function encodeSignedNumber(value: number): string {
  let encoded = '';
  let nextValue = value < 0 ? ~(value << 1) : value << 1;

  while (nextValue >= 0x20) {
    encoded += String.fromCharCode((0x20 | (nextValue & 0x1f)) + 63);
    nextValue >>= 5;
  }

  encoded += String.fromCharCode(nextValue + 63);
  return encoded;
}

function encodePolyline(coordinates: LngLatCoordinate[]): string {
  let previousLat = 0;
  let previousLng = 0;
  let encoded = '';

  coordinates.forEach(([lng, lat]) => {
    const normalizedLat = Math.round(lat * 1e5);
    const normalizedLng = Math.round(lng * 1e5);

    encoded += encodeSignedNumber(normalizedLat - previousLat);
    encoded += encodeSignedNumber(normalizedLng - previousLng);

    previousLat = normalizedLat;
    previousLng = normalizedLng;
  });

  return encoded;
}

function formatMarker(point: StaticMapPoint, color: string, label?: string | null): string {
  const markerLabel = label ? `-${label}` : '';
  return `pin-s${markerLabel}+${color}(${point.lng},${point.lat})`;
}

export function parseMapboxStyleReference(
  styleReference: string
): { username: string; styleId: string } | null {
  const trimmed = styleReference.trim();
  if (!trimmed) {
    return null;
  }

  const stylesPrefix = 'mapbox://styles/';
  if (trimmed.startsWith(stylesPrefix)) {
    const parts = trimmed.slice(stylesPrefix.length).split('/').filter(Boolean);
    if (parts.length >= 2) {
      return {
        username: parts[0],
        styleId: parts[1],
      };
    }
  }

  const apiPrefix = 'https://api.mapbox.com/styles/v1/';
  if (trimmed.startsWith(apiPrefix)) {
    const parts = trimmed.slice(apiPrefix.length).split('/').filter(Boolean);
    if (parts.length >= 2) {
      return {
        username: parts[0],
        styleId: parts[1],
      };
    }
  }

  const directParts = trimmed.split('/').filter(Boolean);
  if (directParts.length === 2) {
    return {
      username: directParts[0],
      styleId: directParts[1],
    };
  }

  return null;
}

export function buildMapboxStaticRouteImageUrl(input: {
  accessToken: string;
  styleId: string;
  routeCoordinates?: LngLatCoordinate[];
  fallbackPoints?: StaticMapPoint[];
  origin?: StaticMapPoint | null;
  nextStop?: StaticMapPoint | null;
  nextStopLabel?: string | null;
  width?: number;
  height?: number;
}): string | null {
  const accessToken = input.accessToken.trim();
  if (!accessToken) {
    return null;
  }

  const parsedStyle = parseMapboxStyleReference(input.styleId);
  if (!parsedStyle) {
    return null;
  }

  const routeCoordinates = clampPathCoordinates(input.routeCoordinates ?? []);
  const fallbackPoints = (input.fallbackPoints ?? [])
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point) => [point.lng, point.lat] as LngLatCoordinate);

  const pathCoordinates = routeCoordinates.length > 1 ? routeCoordinates : fallbackPoints;

  const overlayParts: string[] = [];

  if (pathCoordinates.length > 1) {
    const encodedPath = encodeURIComponent(encodePolyline(pathCoordinates));
    overlayParts.push(`path-4+0ea5e9-0.78(${encodedPath})`);
  }

  if (input.origin) {
    overlayParts.push(formatMarker(input.origin, '0ea5e9'));
  }

  if (input.nextStop) {
    overlayParts.push(formatMarker(input.nextStop, '0f172a', input.nextStopLabel));
  }

  if (!overlayParts.length) {
    return null;
  }

  const width = Math.min(1280, Math.max(320, Math.round(input.width ?? 640)));
  const height = Math.min(1280, Math.max(180, Math.round(input.height ?? 360)));
  const query = new URLSearchParams({
    access_token: accessToken,
    padding: '28',
  });

  return `https://api.mapbox.com/styles/v1/${parsedStyle.username}/${parsedStyle.styleId}/static/${overlayParts.join(',')}/auto/${width}x${height}@2x?${query.toString()}`;
}
