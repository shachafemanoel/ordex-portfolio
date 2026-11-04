import type { DeliveryRouteSessionData } from '@/lib/delivery-route-session';
import { PRIMARY_HEX_500 } from '@/lib/designTokens';
import type { StaticMapPoint } from '@/lib/mapbox-static';

export type DeliverySortMode = 'smart' | 'eta' | 'schedule' | 'city';
export type DeliverySplitStrategy = 'none' | 'zones';

export interface DeliveryBoardItem {
  id: string;
  number: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  city: string | null;
  addressLine: string;
  scheduledAt: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  itemsSummary: string | null;
  itemLabels: string[];
  itemsCount: number;
  etaMinutes: number | null;
  distanceKm: number | null;
  routeIndex: number | null;
  estimatedArrivalAt: string | null;
  estimatedCompletionAt: string | null;
  geocodeSource: 'existing' | 'mapbox' | 'missing';
  routeBucket: 'today' | 'tomorrow';
  autoDeferredToDate: string | null;
  groupId: string | null;
  groupLabel: string | null;
  groupColor: string | null;
  workerIndex: number | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
}

export interface RouteGroupSummary {
  routeStopCount?: number;
  routeDurationMinutes?: number | null;
  routeDistanceKm?: number | null;
  effectiveWorkloadMinutes?: number | null;
}

export interface DeliveryRouteGroupView {
  id: string;
  label: string;
  color: string;
  workerIndex: number;
  items: DeliveryBoardItem[];
  routeCoordinates: Array<[number, number]>;
  summary?: RouteGroupSummary;
  cityLabels: string[];
  assignedWorkerName: string | null;
  leadDelivery: DeliveryBoardItem | null;
}

export type ChecklistStateByRouteId = Record<string, string[]>;

export function formatClockTime(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDurationLabel(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value < 60) {
    return `${value} דק'`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} ש' ${minutes} דק'` : `${hours} ש'`;
}

export function formatDistanceLabel(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const normalized = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${normalized} ק"מ`;
}

export function formatCompactAddress(addressLine: string, city?: string | null): string {
  const parts = [addressLine.trim(), city?.trim()].filter(Boolean);
  return parts.join(', ');
}

export function toStaticMapPoint(
  item: { lat: number | null; lng: number | null } | null
): StaticMapPoint | null {
  if (!item || typeof item.lat !== 'number' || typeof item.lng !== 'number') {
    return null;
  }

  return {
    lat: item.lat,
    lng: item.lng,
  };
}

export function buildNavigationHref(
  item: Pick<DeliveryBoardItem, 'lat' | 'lng' | 'addressLine' | 'city'>
): string {
  if (typeof item.lat === 'number' && typeof item.lng === 'number') {
    return `https://waze.com/ul?ll=${item.lat},${item.lng}&navigate=yes`;
  }

  return `https://waze.com/ul?q=${encodeURIComponent(formatCompactAddress(item.addressLine, item.city))}`;
}

export function buildPhoneHref(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  return `tel:${value.replace(/\s+/g, '')}`;
}

export function deliverySessionToRouteGroup(
  session: DeliveryRouteSessionData
): DeliveryRouteGroupView {
  const items: DeliveryBoardItem[] = session.routeGroup.items.map((item) => ({
    ...item,
    geocodeSource:
      typeof item.lat === 'number' && typeof item.lng === 'number' ? 'existing' : 'missing',
    routeBucket: 'today',
    autoDeferredToDate: null,
    groupId: session.routeGroup.id,
    groupLabel: session.routeGroup.label,
    groupColor: session.routeGroup.color ?? PRIMARY_HEX_500,
    workerIndex: session.routeGroup.workerIndex ?? 1,
    assignedUserId: null,
    assignedUserName: null,
  }));

  const cityLabels = Array.from(
    new Set(items.map((item) => item.city?.trim()).filter((value): value is string => Boolean(value)))
  ).slice(0, 3);

  return {
    id: session.routeGroup.id,
    label: session.routeGroup.label,
    color: session.routeGroup.color ?? PRIMARY_HEX_500,
    workerIndex: session.routeGroup.workerIndex ?? 1,
    items,
    routeCoordinates: session.routeGroup.routeCoordinates,
    summary: session.routeGroup.summary ?? undefined,
    cityLabels,
    assignedWorkerName: null,
    leadDelivery: items[0] ?? null,
  };
}
