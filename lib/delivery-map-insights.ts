export interface DeliveryMapAnalyticsItem {
  id: string;
  status: string;
  city: string | null;
  scheduledAt: string | null;
  lat: number | null;
  lng: number | null;
  etaMinutes?: number | null;
  geocodeSource?: 'existing' | 'mapbox' | 'missing';
  groupId?: string | null;
  groupLabel?: string | null;
  groupColor?: string | null;
  routeBucket?: 'today' | 'tomorrow';
  autoDeferredToDate?: string | null;
}

export interface DeliveryMapHotspot {
  id: string;
  label: string;
  lat: number;
  lng: number;
  count: number;
  overdueCount: number;
  inTransitCount: number;
  deferredCount: number;
  score: number;
  radius: number;
  color: string;
  cityLabels: string[];
}

export interface DeliveryMapInsight {
  id: string;
  label: string;
  value: string;
  tone: 'danger' | 'warning' | 'info' | 'success';
}

export interface DeliveryMapRouteSummary {
  geocodedCount?: number;
  routeStopCount?: number;
  routeDurationMinutes?: number | null;
  routeDistanceKm?: number | null;
  deferredStopCount?: number;
  deferredDateKey?: string | null;
  exceedsBusinessHours?: boolean;
  exceedsOperationalLimit?: boolean;
  activeWorkerCount?: number;
}

const DEFAULT_HOTSPOT_COLOR = '#0085ff';
const HOTSPOT_GRID_SIZE = 0.05;

function normalizeLabel(value: string | null | undefined): string | null {
  if (!value) return null;

  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized ? normalized : null;
}

function hasCoordinates<T extends { lat: number | null; lng: number | null }>(
  item: T
): item is T & { lat: number; lng: number } {
  return typeof item.lat === 'number' && Number.isFinite(item.lat) && typeof item.lng === 'number' && Number.isFinite(item.lng);
}

function isOverdueAt(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;

  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < now.getTime();
}

function isTransitStatus(status: string): boolean {
  return status === 'IN_TRANSIT' || status === 'INSTALLATION';
}

function formatDurationLabel(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value < 60) {
    return `${Math.round(value)} דק'`;
  }

  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours} ש' ${minutes} דק'` : `${hours} ש'`;
}

function formatDistanceLabel(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const normalized = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${normalized} ק"מ`;
}

function formatDeferredDateLabel(value: string | null | undefined): string | null {
  if (!value) return null;

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
  });
}

function resolveHotspotColor(params: {
  explicitColor: string | null;
  overdueCount: number;
  inTransitCount: number;
  deferredCount: number;
}): string {
  if (params.explicitColor) return params.explicitColor;
  if (params.overdueCount > 0) return '#ef4444';
  if (params.inTransitCount > 0) return '#f97316';
  if (params.deferredCount > 0) return '#8b5cf6';
  return DEFAULT_HOTSPOT_COLOR;
}

function buildHotspotKey(item: DeliveryMapAnalyticsItem & { lat: number; lng: number }): string {
  const groupId = normalizeLabel(item.groupId);
  if (groupId) {
    return `group:${groupId}`;
  }

  const city = normalizeLabel(item.city);
  if (city) {
    return `city:${city.toLocaleLowerCase('he-IL')}`;
  }

  const latBucket = Math.round(item.lat / HOTSPOT_GRID_SIZE) * HOTSPOT_GRID_SIZE;
  const lngBucket = Math.round(item.lng / HOTSPOT_GRID_SIZE) * HOTSPOT_GRID_SIZE;
  return `geo:${latBucket.toFixed(2)}:${lngBucket.toFixed(2)}`;
}

export function buildDeliveryMapHotspots(
  items: DeliveryMapAnalyticsItem[],
  options?: {
    maxHotspots?: number;
    now?: Date;
  }
): DeliveryMapHotspot[] {
  const now = options?.now ?? new Date();
  const maxHotspots = options?.maxHotspots ?? 4;
  const hotspots = new Map<
    string,
    {
      id: string;
      label: string | null;
      explicitColor: string | null;
      latTotal: number;
      lngTotal: number;
      count: number;
      overdueCount: number;
      inTransitCount: number;
      deferredCount: number;
      cityLabels: Set<string>;
    }
  >();

  items.filter(hasCoordinates).forEach((item) => {
    const key = buildHotspotKey(item);
    const existing = hotspots.get(key) ?? {
      id: key,
      label: normalizeLabel(item.groupLabel) ?? normalizeLabel(item.city),
      explicitColor: normalizeLabel(item.groupColor),
      latTotal: 0,
      lngTotal: 0,
      count: 0,
      overdueCount: 0,
      inTransitCount: 0,
      deferredCount: 0,
      cityLabels: new Set<string>(),
    };

    const cityLabel = normalizeLabel(item.city);
    if (cityLabel) {
      existing.cityLabels.add(cityLabel);
    }

    existing.latTotal += item.lat;
    existing.lngTotal += item.lng;
    existing.count += 1;
    existing.overdueCount += isOverdueAt(item.scheduledAt, now) ? 1 : 0;
    existing.inTransitCount += isTransitStatus(item.status) ? 1 : 0;
    existing.deferredCount += item.routeBucket === 'tomorrow' || item.autoDeferredToDate ? 1 : 0;

    hotspots.set(key, existing);
  });

  return Array.from(hotspots.values())
    .map((hotspot, index) => {
      const score =
        hotspot.count * 12 +
        hotspot.overdueCount * 18 +
        hotspot.inTransitCount * 8 +
        hotspot.deferredCount * 6;
      const cityLabels = Array.from(hotspot.cityLabels).slice(0, 3);

      return {
        id: hotspot.id,
        label: hotspot.label ?? cityLabels[0] ?? `אזור ${index + 1}`,
        lat: hotspot.latTotal / hotspot.count,
        lng: hotspot.lngTotal / hotspot.count,
        count: hotspot.count,
        overdueCount: hotspot.overdueCount,
        inTransitCount: hotspot.inTransitCount,
        deferredCount: hotspot.deferredCount,
        score,
        radius: Math.max(24, Math.min(56, 24 + hotspot.count * 5 + hotspot.overdueCount * 4)),
        color: resolveHotspotColor({
          explicitColor: hotspot.explicitColor,
          overdueCount: hotspot.overdueCount,
          inTransitCount: hotspot.inTransitCount,
          deferredCount: hotspot.deferredCount,
        }),
        cityLabels,
      } satisfies DeliveryMapHotspot;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label, 'he');
    })
    .slice(0, maxHotspots);
}

export function buildDeliveryMapInsights(
  params: {
    items: DeliveryMapAnalyticsItem[];
    hotspots: DeliveryMapHotspot[];
    routeSummary?: DeliveryMapRouteSummary | null;
    routeLabel?: string | null;
    totalRoutes?: number;
  },
  options?: {
    maxInsights?: number;
  }
): DeliveryMapInsight[] {
  const insights: DeliveryMapInsight[] = [];
  const maxInsights = options?.maxInsights ?? 4;
  const mappedCount =
    params.routeSummary?.geocodedCount ??
    params.items.filter((item) => hasCoordinates(item)).length;

  if (params.routeSummary?.deferredStopCount) {
    const deferredLabel = formatDeferredDateLabel(params.routeSummary.deferredDateKey);
    insights.push({
      id: 'deferred',
      label: 'גלישה',
      value: deferredLabel
        ? `${params.routeSummary.deferredStopCount} עצירות ל-${deferredLabel}`
        : `${params.routeSummary.deferredStopCount} עצירות ליום הבא`,
      tone: 'warning',
    });
  } else if (
    params.routeSummary?.exceedsBusinessHours ||
    params.routeSummary?.exceedsOperationalLimit
  ) {
    insights.push({
      id: 'overflow',
      label: 'עומס',
      value: 'המסלול חורג מהקיבולת היומית',
      tone: 'danger',
    });
  }

  const topHotspot = params.hotspots[0];
  if (topHotspot) {
    const hotspotBits = [`${topHotspot.label}`, `${topHotspot.count} עצירות`];
    if (topHotspot.overdueCount > 0) {
      hotspotBits.push(`${topHotspot.overdueCount} באיחור`);
    }

    insights.push({
      id: 'hotspot',
      label: 'אזור חם',
      value: hotspotBits.join(' • '),
      tone: topHotspot.overdueCount > 0 ? 'danger' : 'warning',
    });
  }

  const routeBits = [
    params.routeSummary?.routeStopCount ? `${params.routeSummary.routeStopCount} עצירות` : null,
    formatDurationLabel(params.routeSummary?.routeDurationMinutes ?? null),
    formatDistanceLabel(params.routeSummary?.routeDistanceKm ?? null),
    params.totalRoutes && params.totalRoutes > 1 ? `${params.totalRoutes} מסלולים` : null,
  ].filter((value): value is string => Boolean(value));

  if (routeBits.length > 0) {
    insights.push({
      id: 'route',
      label: params.totalRoutes && params.totalRoutes > 1 ? 'מסלולים מומלצים' : 'מסלול מומלץ',
      value: params.routeLabel
        ? `${params.routeLabel} • ${routeBits.join(' • ')}`
        : routeBits.join(' • '),
      tone: 'info',
    });
  }

  if (params.items.length > 0) {
    insights.push({
      id: 'coverage',
      label: 'כיסוי מפה',
      value: `${mappedCount}/${params.items.length} נקודות`,
      tone: mappedCount === params.items.length ? 'success' : 'warning',
    });
  }

  if (params.routeSummary?.activeWorkerCount && params.routeSummary.activeWorkerCount > 1) {
    insights.push({
      id: 'crews',
      label: 'צוותים',
      value: `${params.routeSummary.activeWorkerCount} מסלולים פעילים`,
      tone: 'info',
    });
  }

  return insights.slice(0, maxInsights);
}
