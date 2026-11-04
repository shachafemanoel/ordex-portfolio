import { z } from 'zod';

import {
  addDaysToDateKey,
  getBusinessDayDateKey,
  getBusinessDayDurationMinutes,
  getBusinessDayStartUtcForDateKey,
  getBusinessHoursLabel,
  type StoreBusinessHours,
} from '@/lib/store-business-hours';
import {
  buildGeocodeV6ForwardPath,
  fetchMapboxJson,
  hasMapboxAccessToken,
  ISRAEL_BBOX,
} from '@/lib/mapbox/server';
import { getStoreSettings } from '@/lib/store-settings';
import { resolveStoreRouteOrigin, type StoreSettingsDto } from '@/lib/store-settings-schema';

const MAX_ITEMS = 80;
const MAX_GEOCODED_ITEMS = 12;
const MAX_ROUTE_STOPS = 12;
const MAX_OPTIMIZATION_COORDINATES = 12;
export const DEFAULT_OPERATIONAL_ROUTE_LIMIT_MINUTES = 10 * 60;
const AUTO_DEFER_BLOCKED_STATUSES = new Set(['IN_TRANSIT', 'INSTALLATION']);

export const planningItemSchema = z.object({
  id: z.string(),
  number: z.string().optional(),
  customerName: z.string().optional(),
  status: z.string().optional(),
  addressLine: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  serviceMinutes: z.number().min(0).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});

export const planningRequestSchema = z.object({
  items: z.array(planningItemSchema).max(MAX_ITEMS),
  origin: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .nullable()
    .optional(),
  sortMode: z.enum(['smart', 'eta', 'schedule', 'city']).default('smart'),
  grouping: z
    .object({
      strategy: z.enum(['none', 'zones']).default('none'),
      workerCount: z.number().int().min(1).max(6).default(1),
    })
    .optional(),
});

export type PlanningItem = z.infer<typeof planningItemSchema>;
export type PlanningSortMode = z.infer<typeof planningRequestSchema>['sortMode'];
export type PlanningGrouping = NonNullable<z.infer<typeof planningRequestSchema>['grouping']>;

type RouteMetrics = {
  etaMinutes: number | null;
  distanceKm: number | null;
  routeIndex: number | null;
  estimatedArrivalAt: string | null;
  estimatedCompletionAt: string | null;
};

type PairwiseTravelMinutesMap = Map<string, Map<string, number | null>>;

export type EnrichedPlanningItem = PlanningItem & {
  lat: number | null;
  lng: number | null;
  etaMinutes: number | null;
  distanceKm: number | null;
  originEtaMinutes: number | null;
  originDistanceKm: number | null;
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
};

type RoutePlan = {
  orderedIds: string[];
  metricsById: Map<string, RouteMetrics>;
  route: {
    coordinates: Array<[number, number]>;
    durationMinutes: number | null;
    driveDurationMinutes: number | null;
    serviceDurationMinutes: number;
    distanceKm: number | null;
    orderedIds: string[];
    departureAt: string;
  } | null;
};

export type DeliveryPlanningSummary = {
  geocodedCount: number;
  etaCount: number;
  routeStopCount: number;
  routeDurationMinutes: number | null;
  routeDriveMinutes: number | null;
  routeServiceMinutes: number;
  routeDistanceKm: number | null;
  hasOrigin: boolean;
  originSource: 'user' | 'store' | 'none';
  originLabel: string | null;
  departureAt: string | null;
  effectiveWorkloadMinutes: number;
  businessDayStartTime: string;
  businessDayEndTime: string;
  businessHoursLabel: string;
  businessDayAvailableMinutes: number;
  exceedsBusinessHours: boolean;
  overflowMinutes: number;
  operationalRouteLimitMinutes: number;
  exceedsOperationalLimit: boolean;
  operationalOverflowMinutes: number;
  preSplitWorkloadMinutes: number;
  preSplitOperationalOverflowMinutes: number;
  autoSplitApplied: boolean;
  deferredStopCount: number;
  deferredDateKey: string | null;
  deferredWorkloadMinutes: number | null;
  groupingStrategy: 'none' | 'zones';
  requestedWorkerCount: number;
  activeWorkerCount: number;
  zoneSplitApplied: boolean;
};

export type DeferredDeliveryPlan = {
  dateKey: string;
  items: EnrichedPlanningItem[];
  route: RoutePlan['route'];
  summary: {
    routeStopCount: number;
    routeDurationMinutes: number | null;
    routeDriveMinutes: number | null;
    routeServiceMinutes: number;
    routeDistanceKm: number | null;
    effectiveWorkloadMinutes: number;
  };
};

export type DeliveryRouteGroup = {
  id: string;
  label: string;
  color: string;
  workerIndex: number;
  items: EnrichedPlanningItem[];
  route: RoutePlan['route'];
  summary: {
    routeStopCount: number;
    routeDurationMinutes: number | null;
    routeDriveMinutes: number | null;
    routeServiceMinutes: number;
    routeDistanceKm: number | null;
    effectiveWorkloadMinutes: number;
  };
};

export type DeliveryPlanningData = {
  items: EnrichedPlanningItem[];
  summary: DeliveryPlanningSummary;
  route: RoutePlan['route'];
  origin: { lat: number; lng: number } | null;
  deferred: DeferredDeliveryPlan | null;
  routeGroups: DeliveryRouteGroup[];
};

function buildAddressQuery(item: PlanningItem): string | null {
  const parts = [item.addressLine?.trim(), item.city?.trim(), 'ישראל'].filter(
    (value): value is string => Boolean(value)
  );

  return parts.length ? parts.join(', ') : null;
}

function buildCoordinateString(points: Array<{ lat: number; lng: number }>): string {
  return points.map((point) => `${point.lng},${point.lat}`).join(';');
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toIsoTime(value?: string | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function toFiniteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function getServiceMinutes(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.round(value);
}

function toIsoOffset(base: Date, minutes: number): string | null {
  const date = new Date(base.getTime() + minutes * 60 * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function haversineDistanceKm(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): number {
  const earthRadiusKm = 6371;
  const dLat = ((end.lat - start.lat) * Math.PI) / 180;
  const dLng = ((end.lng - start.lng) * Math.PI) / 180;
  const lat1 = (start.lat * Math.PI) / 180;
  const lat2 = (end.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeWithMapbox(item: PlanningItem): Promise<{
  lat: number;
  lng: number;
} | null> {
  const query = buildAddressQuery(item);
  if (!query) return null;

  const path = buildGeocodeV6ForwardPath({
    q: query,
    autocomplete: false,
    limit: 1,
    country: 'IL',
    bbox: ISRAEL_BBOX,
  });
  const payload = await fetchMapboxJson<{
    features?: Array<{
      geometry?: {
        coordinates?: [number, number];
      };
    }>;
  }>(path);

  const coordinates = payload?.features?.[0]?.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  return {
    lng: coordinates[0],
    lat: coordinates[1],
  };
}

async function resolveStoreOrigin(storeSettings: StoreSettingsDto): Promise<{
  origin: { lat: number; lng: number } | null;
  label: string | null;
}> {
  const routeOrigin = resolveStoreRouteOrigin(storeSettings);
  const addressLine = routeOrigin.addressLine?.trim();
  const city = routeOrigin.city?.trim();
  const label = routeOrigin.label;

  if (typeof routeOrigin.lat === 'number' && typeof routeOrigin.lng === 'number') {
    return {
      origin: {
        lat: routeOrigin.lat,
        lng: routeOrigin.lng,
      },
      label,
    };
  }

  if (!label) {
    return { origin: null, label: null };
  }

  const geocoded = await geocodeWithMapbox({
    id: 'store-origin',
    addressLine,
    city,
  });

  return {
    origin: geocoded,
    label,
  };
}

async function fetchOriginEtaMap(
  origin: { lat: number; lng: number } | null,
  items: EnrichedPlanningItem[]
): Promise<Map<string, { etaMinutes: number | null; distanceKm: number | null }>> {
  const metrics = new Map<string, { etaMinutes: number | null; distanceKm: number | null }>();
  if (!origin) {
    return metrics;
  }

  const validItems = items.filter(
    (item): item is EnrichedPlanningItem & { lat: number; lng: number } =>
      typeof item.lat === 'number' && typeof item.lng === 'number'
  );

  for (const group of chunkItems(validItems, 9)) {
    const points = [origin, ...group.map((item) => ({ lat: item.lat, lng: item.lng }))];
    const destinations = group.map((_, index) => String(index + 1)).join(';');
    const payload = await fetchMapboxJson<{
      durations?: number[][];
      distances?: number[][];
    }>(
      `/directions-matrix/v1/mapbox/driving-traffic/${buildCoordinateString(points)}?sources=0&destinations=${destinations}&annotations=duration,distance`
    );

    const durations = payload?.durations?.[0] ?? [];
    const distances = payload?.distances?.[0] ?? [];

    group.forEach((item, index) => {
      const duration = durations[index];
      const distance = distances[index];
      metrics.set(item.id, {
        etaMinutes: Number.isFinite(duration) ? Math.round(duration / 60) : null,
        distanceKm: Number.isFinite(distance) ? Number((distance / 1000).toFixed(1)) : null,
      });
    });
  }

  return metrics;
}

async function fetchPairwiseTravelMinutesMap(
  items: Array<Pick<EnrichedPlanningItem, 'id' | 'lat' | 'lng'>>
): Promise<PairwiseTravelMinutesMap | null> {
  const withCoords = items.filter(
    (item): item is Pick<EnrichedPlanningItem, 'id'> & { lat: number; lng: number } =>
      typeof item.lat === 'number' && typeof item.lng === 'number'
  );

  if (withCoords.length < 2 || withCoords.length > 25) {
    return null;
  }

  const payload = await fetchMapboxJson<{
    durations?: Array<Array<number | null>>;
  }>(
    `/directions-matrix/v1/mapbox/driving-traffic/${buildCoordinateString(withCoords)}?annotations=duration`
  );

  const durations = payload?.durations;
  if (!durations?.length) {
    return null;
  }

  const pairwise = new Map<string, Map<string, number | null>>();

  withCoords.forEach((originItem, originIndex) => {
    const row = new Map<string, number | null>();

    withCoords.forEach((destinationItem, destinationIndex) => {
      if (originItem.id === destinationItem.id) {
        return;
      }

      const durationSeconds = durations[originIndex]?.[destinationIndex];
      row.set(
        destinationItem.id,
        typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
          ? Math.round(durationSeconds / 60)
          : null
      );
    });

    pairwise.set(originItem.id, row);
  });

  return pairwise;
}

function buildRouteMetrics(
  orderedStops: Array<Pick<EnrichedPlanningItem, 'id' | 'serviceMinutes'>>,
  legs: Array<{ duration?: number; distance?: number }> | undefined,
  departureAt: Date
): {
  metricsById: Map<string, RouteMetrics>;
  driveDurationMinutes: number | null;
  serviceDurationMinutes: number;
} {
  const metricsById = new Map<string, RouteMetrics>();
  let cumulativeDriveSeconds = 0;
  let cumulativeDistanceMeters = 0;
  let cumulativeServiceMinutes = 0;

  orderedStops.forEach((stop, index) => {
    const leg = legs?.[index];
    cumulativeDriveSeconds += toFiniteOrNull(leg?.duration) ?? 0;
    cumulativeDistanceMeters += toFiniteOrNull(leg?.distance) ?? 0;

    const arrivalMinutes = Math.round(cumulativeDriveSeconds / 60) + cumulativeServiceMinutes;
    const serviceMinutes = getServiceMinutes(stop.serviceMinutes);
    const completionMinutes = arrivalMinutes + serviceMinutes;

    metricsById.set(stop.id, {
      etaMinutes: arrivalMinutes,
      distanceKm: Number((cumulativeDistanceMeters / 1000).toFixed(1)),
      routeIndex: index + 1,
      estimatedArrivalAt: toIsoOffset(departureAt, arrivalMinutes),
      estimatedCompletionAt: toIsoOffset(departureAt, completionMinutes),
    });

    cumulativeServiceMinutes += serviceMinutes;
  });

  return {
    metricsById,
    driveDurationMinutes: orderedStops.length > 0 ? Math.round(cumulativeDriveSeconds / 60) : null,
    serviceDurationMinutes: cumulativeServiceMinutes,
  };
}

function sortEnrichedItems(
  items: EnrichedPlanningItem[],
  sortMode: PlanningSortMode
): EnrichedPlanningItem[] {
  const nextItems = [...items];

  nextItems.sort((left, right) => {
    const leftEta = left.etaMinutes ?? Number.MAX_SAFE_INTEGER;
    const rightEta = right.etaMinutes ?? Number.MAX_SAFE_INTEGER;
    const leftSchedule = toIsoTime(left.scheduledAt);
    const rightSchedule = toIsoTime(right.scheduledAt);
    const leftCity = left.city?.trim() || 'zzz';
    const rightCity = right.city?.trim() || 'zzz';

    if (sortMode === 'eta') {
      return (
        leftEta - rightEta ||
        leftSchedule - rightSchedule ||
        leftCity.localeCompare(rightCity, 'he')
      );
    }

    if (sortMode === 'schedule') {
      return (
        leftSchedule - rightSchedule ||
        leftEta - rightEta ||
        leftCity.localeCompare(rightCity, 'he')
      );
    }

    if (sortMode === 'city') {
      return (
        leftCity.localeCompare(rightCity, 'he') ||
        leftSchedule - rightSchedule ||
        leftEta - rightEta
      );
    }

    return (
      leftEta - rightEta || leftSchedule - rightSchedule || leftCity.localeCompare(rightCity, 'he')
    );
  });

  return nextItems.map((item, index) => ({
    ...item,
    routeIndex: index < MAX_ROUTE_STOPS ? index + 1 : null,
  }));
}

function pickOptimizationCandidates(
  items: EnrichedPlanningItem[],
  limit: number
): Array<EnrichedPlanningItem & { lat: number; lng: number }> {
  return items
    .filter(
      (item): item is EnrichedPlanningItem & { lat: number; lng: number } =>
        typeof item.lat === 'number' && typeof item.lng === 'number'
    )
    .sort((left, right) => {
      const scheduleDiff = toIsoTime(left.scheduledAt) - toIsoTime(right.scheduledAt);
      if (scheduleDiff !== 0) return scheduleDiff;

      const etaDiff =
        (left.etaMinutes ?? Number.MAX_SAFE_INTEGER) -
        (right.etaMinutes ?? Number.MAX_SAFE_INTEGER);
      if (etaDiff !== 0) return etaDiff;

      return (
        (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .slice(0, limit);
}

function pickOptimizationDestination(
  origin: { lat: number; lng: number },
  items: Array<EnrichedPlanningItem & { lat: number; lng: number }>
) {
  const scheduledItems = items.filter(
    (item) => toIsoTime(item.scheduledAt) !== Number.MAX_SAFE_INTEGER
  );
  if (scheduledItems.length > 0) {
    return [...scheduledItems].sort(
      (left, right) => toIsoTime(right.scheduledAt) - toIsoTime(left.scheduledAt)
    )[0];
  }

  return [...items].sort(
    (left, right) => haversineDistanceKm(origin, right) - haversineDistanceKm(origin, left)
  )[0];
}

async function fetchOptimizedRoutePlan(
  origin: { lat: number; lng: number } | null,
  items: EnrichedPlanningItem[],
  departureAt: Date
): Promise<RoutePlan | null> {
  if (!origin) {
    return null;
  }

  const maxStops = Math.min(MAX_ROUTE_STOPS, MAX_OPTIMIZATION_COORDINATES - 1);
  const candidates = pickOptimizationCandidates(items, maxStops);
  if (!candidates.length) {
    return null;
  }

  if (candidates.length === 1) {
    const singleItem = candidates[0];
    return await fetchRouteGeometry(
      origin,
      [
        {
          ...singleItem,
          routeIndex: 1,
        },
      ],
      departureAt
    );
  }

  const destination = pickOptimizationDestination(origin, candidates);
  const intermediateStops = candidates.filter((item) => item.id !== destination.id);
  const orderedInput = [origin, ...intermediateStops, destination];
  const itemByInputIndex = new Map<number, string>();

  intermediateStops.forEach((item, index) => {
    itemByInputIndex.set(index + 1, item.id);
  });
  itemByInputIndex.set(orderedInput.length - 1, destination.id);

  const payload = await fetchMapboxJson<{
    trips?: Array<{
      duration?: number;
      distance?: number;
      geometry?: {
        coordinates?: Array<[number, number]>;
      };
      legs?: Array<{
        duration?: number;
        distance?: number;
      }>;
    }>;
    waypoints?: Array<{
      waypoint_index?: number;
    }>;
  }>(
    `/optimized-trips/v1/mapbox/driving-traffic/${buildCoordinateString(orderedInput)}?source=first&destination=last&roundtrip=false&geometries=geojson&overview=full`
  );

  const trip = payload?.trips?.[0];
  const waypoints = payload?.waypoints ?? [];

  if (!trip || !waypoints.length) {
    return null;
  }

  const orderedStops = waypoints
    .map((waypoint, inputIndex) => ({
      inputIndex,
      waypointIndex: waypoint.waypoint_index ?? Number.MAX_SAFE_INTEGER,
      itemId: itemByInputIndex.get(inputIndex) ?? null,
    }))
    .filter((entry): entry is { inputIndex: number; waypointIndex: number; itemId: string } =>
      Boolean(entry.itemId)
    )
    .sort((left, right) => left.waypointIndex - right.waypointIndex);

  if (!orderedStops.length) {
    return null;
  }

  const candidateById = new Map(candidates.map((item) => [item.id, item]));
  const orderedItems = orderedStops
    .map((stop) => candidateById.get(stop.itemId))
    .filter((item): item is EnrichedPlanningItem & { lat: number; lng: number } => Boolean(item));
  const { metricsById, driveDurationMinutes, serviceDurationMinutes } = buildRouteMetrics(
    orderedItems,
    trip.legs,
    departureAt
  );

  return {
    orderedIds: orderedStops.map((stop) => stop.itemId),
    metricsById,
    route: {
      coordinates: (trip.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng]),
      durationMinutes:
        driveDurationMinutes !== null ? driveDurationMinutes + serviceDurationMinutes : null,
      driveDurationMinutes,
      serviceDurationMinutes,
      distanceKm: Number.isFinite(trip.distance)
        ? Number(((trip.distance ?? 0) / 1000).toFixed(1))
        : null,
      orderedIds: orderedStops.map((stop) => stop.itemId),
      departureAt: departureAt.toISOString(),
    },
  };
}

async function fetchRouteGeometry(
  origin: { lat: number; lng: number } | null,
  items: EnrichedPlanningItem[],
  departureAt: Date
): Promise<RoutePlan | null> {
  const routeStops = items
    .filter(
      (item): item is EnrichedPlanningItem & { lat: number; lng: number; routeIndex: number } =>
        typeof item.lat === 'number' &&
        typeof item.lng === 'number' &&
        typeof item.routeIndex === 'number' &&
        item.routeIndex <= MAX_ROUTE_STOPS
    )
    .sort((left, right) => (left.routeIndex ?? 0) - (right.routeIndex ?? 0));

  if (!routeStops.length) {
    return null;
  }

  const points = [
    ...(origin ? [origin] : []),
    ...routeStops.map((item) => ({ lat: item.lat, lng: item.lng })),
  ];

  if (points.length < 2) {
    return null;
  }

  const payload = await fetchMapboxJson<{
    routes?: Array<{
      duration?: number;
      distance?: number;
      geometry?: {
        coordinates?: Array<[number, number]>;
      };
      legs?: Array<{
        duration?: number;
        distance?: number;
      }>;
    }>;
  }>(
    `/directions/v5/mapbox/driving-traffic/${buildCoordinateString(points)}?geometries=geojson&overview=full&steps=false`
  );

  const route = payload?.routes?.[0];
  const coordinates = route?.geometry?.coordinates ?? [];

  if (!route || !coordinates.length) {
    return null;
  }

  const { metricsById, driveDurationMinutes, serviceDurationMinutes } = buildRouteMetrics(
    routeStops,
    route.legs,
    departureAt
  );

  return {
    orderedIds: routeStops.map((item) => item.id),
    metricsById,
    route: {
      coordinates: coordinates.map(([lng, lat]) => [lat, lng]),
      durationMinutes:
        driveDurationMinutes !== null ? driveDurationMinutes + serviceDurationMinutes : null,
      driveDurationMinutes,
      serviceDurationMinutes,
      distanceKm: Number.isFinite(route?.distance)
        ? Number(((route?.distance ?? 0) / 1000).toFixed(1))
        : null,
      orderedIds: routeStops.map((item) => item.id),
      departureAt: departureAt.toISOString(),
    },
  };
}

export function getOperationalRouteLimitMinutes(
  settings: Pick<StoreBusinessHours, 'businessDayStartTime' | 'businessDayEndTime'>
) {
  const businessDayMinutes = getBusinessDayDurationMinutes(settings);
  return businessDayMinutes > 0
    ? Math.min(DEFAULT_OPERATIONAL_ROUTE_LIMIT_MINUTES, businessDayMinutes)
    : DEFAULT_OPERATIONAL_ROUTE_LIMIT_MINUTES;
}

function buildPlanningSummary(input: {
  settings: Pick<StoreBusinessHours, 'businessDayStartTime' | 'businessDayEndTime' | 'timezone'>;
  route: RoutePlan['route'] | null;
  items: Array<Pick<PlanningItem, 'serviceMinutes'>>;
  hasOrigin: boolean;
  originSource: 'user' | 'store' | 'none';
  originLabel: string | null;
  operationalRouteLimitMinutes: number;
  autoSplitApplied?: boolean;
  deferredStopCount?: number;
  deferredDateKey?: string | null;
  deferredWorkloadMinutes?: number | null;
  preSplitWorkloadMinutes?: number;
  groupingStrategy?: 'none' | 'zones';
  requestedWorkerCount?: number;
  activeWorkerCount?: number;
  zoneSplitApplied?: boolean;
}) {
  const { items, route, settings } = input;

  const serviceOnlyMinutes = items.reduce(
    (total, item) => total + getServiceMinutes(item.serviceMinutes),
    0
  );
  const effectiveWorkloadMinutes =
    route?.durationMinutes ?? route?.serviceDurationMinutes ?? serviceOnlyMinutes;
  const businessDayAvailableMinutes = getBusinessDayDurationMinutes(settings);
  const overflowMinutes = Math.max(0, effectiveWorkloadMinutes - businessDayAvailableMinutes);
  const operationalOverflowMinutes = Math.max(
    0,
    effectiveWorkloadMinutes - input.operationalRouteLimitMinutes
  );
  const preSplitWorkloadMinutes = input.preSplitWorkloadMinutes ?? effectiveWorkloadMinutes;

  return {
    geocodedCount: 0,
    etaCount: 0,
    routeStopCount: route?.orderedIds.length ?? 0,
    routeDurationMinutes: route?.durationMinutes ?? null,
    routeDriveMinutes: route?.driveDurationMinutes ?? null,
    routeServiceMinutes: route?.serviceDurationMinutes ?? 0,
    routeDistanceKm: route?.distanceKm ?? null,
    hasOrigin: input.hasOrigin,
    originSource: input.originSource,
    originLabel: input.originLabel,
    departureAt: route?.departureAt ?? null,
    effectiveWorkloadMinutes,
    businessDayStartTime: settings.businessDayStartTime,
    businessDayEndTime: settings.businessDayEndTime,
    businessHoursLabel: getBusinessHoursLabel(settings),
    businessDayAvailableMinutes,
    exceedsBusinessHours: overflowMinutes > 0,
    overflowMinutes,
    operationalRouteLimitMinutes: input.operationalRouteLimitMinutes,
    exceedsOperationalLimit: operationalOverflowMinutes > 0,
    operationalOverflowMinutes,
    preSplitWorkloadMinutes,
    preSplitOperationalOverflowMinutes: Math.max(
      0,
      preSplitWorkloadMinutes - input.operationalRouteLimitMinutes
    ),
    autoSplitApplied: Boolean(input.autoSplitApplied),
    deferredStopCount: input.deferredStopCount ?? 0,
    deferredDateKey: input.deferredDateKey ?? null,
    deferredWorkloadMinutes: input.deferredWorkloadMinutes ?? null,
    groupingStrategy: input.groupingStrategy ?? 'none',
    requestedWorkerCount: input.requestedWorkerCount ?? 1,
    activeWorkerCount: input.activeWorkerCount ?? 1,
    zoneSplitApplied: Boolean(input.zoneSplitApplied),
  };
}

function buildDeferredPlanSummary(plan: DeliveryPlanningData): DeferredDeliveryPlan['summary'] {
  return {
    routeStopCount: plan.summary.routeStopCount,
    routeDurationMinutes: plan.summary.routeDurationMinutes,
    routeDriveMinutes: plan.summary.routeDriveMinutes,
    routeServiceMinutes: plan.summary.routeServiceMinutes,
    routeDistanceKm: plan.summary.routeDistanceKm,
    effectiveWorkloadMinutes: plan.summary.effectiveWorkloadMinutes,
  };
}

function pickAutoDeferredCandidates(items: EnrichedPlanningItem[]): EnrichedPlanningItem[] {
  return [...items]
    .filter((item) => !AUTO_DEFER_BLOCKED_STATUSES.has(item.status ?? ''))
    .sort((left, right) => {
      const distanceDiff =
        (right.originDistanceKm ?? Number.NEGATIVE_INFINITY) -
        (left.originDistanceKm ?? Number.NEGATIVE_INFINITY);
      if (distanceDiff !== 0) return distanceDiff;

      const scheduleDiff = toIsoTime(right.scheduledAt) - toIsoTime(left.scheduledAt);
      if (scheduleDiff !== 0) return scheduleDiff;

      return getServiceMinutes(right.serviceMinutes) - getServiceMinutes(left.serviceMinutes);
    });
}

export function pickAutoDeferredCandidateIds(
  items: Array<
    Pick<
      EnrichedPlanningItem,
      'id' | 'status' | 'scheduledAt' | 'originDistanceKm' | 'serviceMinutes'
    >
  >
) {
  return pickAutoDeferredCandidates(items as EnrichedPlanningItem[]).map((item) => item.id);
}

const ROUTE_GROUP_COLORS = ['#0085ff', '#ff8a00', '#12b981', '#ef4444', '#8b5cf6', '#0f172a'];

type ZoneGroupingItem = Pick<
  EnrichedPlanningItem,
  'id' | 'lat' | 'lng' | 'serviceMinutes' | 'originDistanceKm' | 'scheduledAt'
> & {
  city?: string | null;
};

function average(numbers: number[]): number {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function calculateBearingDegrees(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
) {
  const lat1 = (start.lat * Math.PI) / 180;
  const lat2 = (end.lat * Math.PI) / 180;
  const dLng = ((end.lng - start.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function calculateBearingDeltaDegrees(left: number, right: number) {
  const rawDelta = Math.abs(left - right) % 360;
  return rawDelta > 180 ? 360 - rawDelta : rawDelta;
}

function calculateCentroid(points: Array<{ lat: number; lng: number }>) {
  return {
    lat: average(points.map((point) => point.lat)),
    lng: average(points.map((point) => point.lng)),
  };
}

function normalizeCityLabel(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/\s+/g, ' ');
  return trimmed || null;
}

function hasCoordinates<T extends { lat: number | null; lng: number | null }>(
  item: T
): item is T & { lat: number; lng: number } {
  return typeof item.lat === 'number' && Number.isFinite(item.lat) && typeof item.lng === 'number' && Number.isFinite(item.lng);
}

function getOriginDistanceKm(
  item: Pick<ZoneGroupingItem, 'lat' | 'lng' | 'originDistanceKm'>,
  origin: { lat: number; lng: number } | null
) {
  if (typeof item.originDistanceKm === 'number' && Number.isFinite(item.originDistanceKm)) {
    return item.originDistanceKm;
  }

  if (origin && hasCoordinates(item)) {
    return haversineDistanceKm(origin, item);
  }

  return null;
}

function buildTargetBundleSizes(totalItems: number, maxBundleSize: number) {
  if (totalItems <= 0) {
    return [] as number[];
  }

  if (totalItems <= 1) {
    return [1];
  }

  const normalizedBundleSize = Math.max(2, Math.min(maxBundleSize, 3));
  const bundleCount = Math.max(1, Math.ceil(totalItems / normalizedBundleSize));
  const baseSize = Math.floor(totalItems / bundleCount);
  const remainder = totalItems % bundleCount;

  return Array.from({ length: bundleCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function estimateTravelMinutesBetweenItems(
  left: ZoneGroupingItem,
  right: ZoneGroupingItem,
  pairwiseTravelMinutes: PairwiseTravelMinutesMap | null | undefined
) {
  const matrixDuration =
    pairwiseTravelMinutes?.get(left.id)?.get(right.id) ??
    pairwiseTravelMinutes?.get(right.id)?.get(left.id) ??
    null;

  if (typeof matrixDuration === 'number' && Number.isFinite(matrixDuration)) {
    return matrixDuration;
  }

  if (hasCoordinates(left) && hasCoordinates(right)) {
    return Math.max(4, Math.round(haversineDistanceKm(left, right) * 2.1));
  }

  const leftCity = normalizeCityLabel(left.city);
  const rightCity = normalizeCityLabel(right.city);
  if (leftCity && rightCity && leftCity === rightCity) {
    return 8;
  }

  const originDistanceDelta = Math.abs(
    (left.originDistanceKm ?? 0) - (right.originDistanceKm ?? 0)
  );
  return 16 + Math.round(originDistanceDelta);
}

function scoreBundleCandidate(
  bundle: ZoneGroupingItem[],
  candidate: ZoneGroupingItem,
  origin: { lat: number; lng: number } | null,
  pairwiseTravelMinutes: PairwiseTravelMinutesMap | null | undefined
) {
  const closestTravelMinutes = Math.min(
    ...bundle.map((item) =>
      estimateTravelMinutesBetweenItems(item, candidate, pairwiseTravelMinutes)
    )
  );

  const bundleOriginDistances = bundle
    .map((item) => getOriginDistanceKm(item, origin))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const candidateOriginDistance = getOriginDistanceKm(candidate, origin);
  const averageBundleOriginDistance = bundleOriginDistances.length
    ? average(bundleOriginDistances)
    : candidateOriginDistance;
  const originDistancePenalty =
    typeof candidateOriginDistance === 'number' &&
    typeof averageBundleOriginDistance === 'number' &&
    Number.isFinite(candidateOriginDistance) &&
    Number.isFinite(averageBundleOriginDistance)
      ? Math.abs(candidateOriginDistance - averageBundleOriginDistance) / 4
      : 0;

  const seed = bundle[0];
  const seedBearing = origin && hasCoordinates(seed) ? calculateBearingDegrees(origin, seed) : null;
  const candidateBearing =
    origin && hasCoordinates(candidate) ? calculateBearingDegrees(origin, candidate) : null;
  const directionPenalty =
    typeof seedBearing === 'number' && typeof candidateBearing === 'number'
      ? calculateBearingDeltaDegrees(seedBearing, candidateBearing) / 18
      : 0;

  const bundleCities = new Set(
    bundle
      .map((item) => normalizeCityLabel(item.city))
      .filter((value): value is string => Boolean(value))
  );
  const candidateCity = normalizeCityLabel(candidate.city);
  const cityBonus = candidateCity && bundleCities.has(candidateCity) ? -10 : 0;

  const schedulePenalty =
    bundle.some((item) => normalizeCityLabel(item.city) === candidateCity) ||
    !candidate.scheduledAt ||
    toIsoTime(candidate.scheduledAt) === Number.MAX_SAFE_INTEGER
      ? 0
      : 2;

  return (
    closestTravelMinutes + originDistancePenalty + directionPenalty + schedulePenalty + cityBonus
  );
}

function pickNextBundleSeed(
  remaining: ZoneGroupingItem[],
  origin: { lat: number; lng: number } | null
) {
  return [...remaining].sort((left, right) => {
    const leftDistance = getOriginDistanceKm(left, origin) ?? Number.NEGATIVE_INFINITY;
    const rightDistance = getOriginDistanceKm(right, origin) ?? Number.NEGATIVE_INFINITY;
    if (rightDistance !== leftDistance) {
      return rightDistance - leftDistance;
    }

    const leftHasCoords = hasCoordinates(left) ? 1 : 0;
    const rightHasCoords = hasCoordinates(right) ? 1 : 0;
    if (rightHasCoords !== leftHasCoords) {
      return rightHasCoords - leftHasCoords;
    }

    return toIsoTime(left.scheduledAt) - toIsoTime(right.scheduledAt);
  })[0];
}

function buildRouteGroupCityLabels(items: Array<Pick<ZoneGroupingItem, 'city'>>, limit = 2) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const city = normalizeCityLabel(item.city);
    if (!city) {
      return;
    }

    counts.set(city, (counts.get(city) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'he'))
    .slice(0, limit)
    .map(([city]) => city);
}

function buildDirectionLabel(
  items: Array<Pick<ZoneGroupingItem, 'lat' | 'lng'>>,
  origin: { lat: number; lng: number } | null
) {
  if (!origin) {
    return null;
  }

  const withCoords = items.filter(hasCoordinates);
  if (!withCoords.length) {
    return null;
  }

  const bearing = calculateBearingDegrees(origin, calculateCentroid(withCoords));

  if (bearing >= 315 || bearing < 45) return 'צפון';
  if (bearing < 135) return 'מזרח';
  if (bearing < 225) return 'דרום';
  return 'מערב';
}

function buildRouteGroupLabel(
  items: Array<Pick<ZoneGroupingItem, 'city' | 'lat' | 'lng'>>,
  index: number,
  origin: { lat: number; lng: number } | null
) {
  const cityLabels = buildRouteGroupCityLabels(items);
  if (cityLabels.length > 0) {
    return cityLabels.join(' • ');
  }

  const directionLabel = buildDirectionLabel(items, origin);
  return directionLabel ? `מסלול ${index + 1} • ${directionLabel}` : `מסלול ${index + 1}`;
}

export function splitPlanningItemsIntoZones(
  items: ZoneGroupingItem[],
  maxBundleSize: number,
  origin: { lat: number; lng: number } | null,
  pairwiseTravelMinutes?: PairwiseTravelMinutesMap | null
) {
  if (items.length <= 1) {
    return [items.map((item) => item.id)];
  }

  const targetBundleSizes = buildTargetBundleSizes(items.length, maxBundleSize);
  const remaining = [...items];
  const bundles = targetBundleSizes.map((targetSize) => {
    const seed = pickNextBundleSeed(remaining, origin);
    if (!seed) {
      return [] as ZoneGroupingItem[];
    }

    remaining.splice(
      remaining.findIndex((item) => item.id === seed.id),
      1
    );

    const bundle = [seed];

    while (bundle.length < targetSize && remaining.length > 0) {
      const nextItem = [...remaining].sort(
        (left, right) =>
          scoreBundleCandidate(bundle, left, origin, pairwiseTravelMinutes) -
          scoreBundleCandidate(bundle, right, origin, pairwiseTravelMinutes)
      )[0];

      if (!nextItem) {
        break;
      }

      bundle.push(nextItem);
      remaining.splice(
        remaining.findIndex((item) => item.id === nextItem.id),
        1
      );
    }

    return bundle;
  });

  if (remaining.length > 0 && bundles.length > 0) {
    remaining.forEach((item) => {
      const bestBundleIndex = bundles.reduce((bestIndex, bundle, index, bundleList) => {
        const bestBundle = bundleList[bestIndex];
        const bundleCapacity = targetBundleSizes[index] ?? 3;
        const bestBundleCapacity = targetBundleSizes[bestIndex] ?? 3;

        if (bundle.length >= bundleCapacity) {
          return bestIndex;
        }

        if (bestBundle.length >= bestBundleCapacity) {
          return index;
        }

        return scoreBundleCandidate(bundle, item, origin, pairwiseTravelMinutes) <
          scoreBundleCandidate(bestBundle, item, origin, pairwiseTravelMinutes)
          ? index
          : bestIndex;
      }, 0);

      bundles[bestBundleIndex].push(item);
    });
  }

  const withCoords = items.filter(hasCoordinates);
  const originReference = origin ?? (withCoords.length > 0 ? calculateCentroid(withCoords) : null);

  return bundles
    .map((bundle) => {
      const bundleWithCoords = bundle.filter(hasCoordinates);
      const sortKey =
        originReference && bundleWithCoords.length > 0
          ? average(bundleWithCoords.map((item) => calculateBearingDegrees(originReference, item)))
          : -average(
              bundle
                .map((item) => getOriginDistanceKm(item, originReference))
                .filter(
                  (value): value is number => typeof value === 'number' && Number.isFinite(value)
                )
            );

      return {
        ids: bundle.map((item) => item.id),
        sortKey,
      };
    })
    .sort((left, right) => left.sortKey - right.sortKey)
    .map((bundle) => bundle.ids)
    .filter((bundle) => bundle.length > 0);
}

async function buildGroupedDeliveryPlans(input: {
  items: EnrichedPlanningItem[];
  originalItems: PlanningItem[];
  grouping: PlanningGrouping;
  effectiveOrigin: { lat: number; lng: number } | null;
  sortMode: PlanningSortMode;
  departureAt: Date;
  storeSettings: StoreSettingsDto;
  originSource: 'user' | 'store' | 'none';
  originLabel: string | null;
}) {
  if (
    input.grouping.strategy !== 'zones' ||
    input.grouping.workerCount <= 1 ||
    input.items.length <= 1
  ) {
    return [] as DeliveryRouteGroup[];
  }

  const pairwiseTravelMinutes = await fetchPairwiseTravelMinutesMap(input.items);
  const zoneIds = splitPlanningItemsIntoZones(
    input.items,
    input.grouping.workerCount,
    input.effectiveOrigin,
    pairwiseTravelMinutes
  );
  const originalItemsById = new Map(input.originalItems.map((item) => [item.id, item]));

  const groups = await Promise.all(
    zoneIds.map(async (itemIds, index): Promise<DeliveryRouteGroup | null> => {
      const groupInputItems = itemIds
        .map((itemId) => originalItemsById.get(itemId))
        .filter((item): item is PlanningItem => Boolean(item));

      if (!groupInputItems.length) {
        return null;
      }

      const groupPlan = await buildDeliveryPlanningData({
        items: groupInputItems,
        effectiveOrigin: input.effectiveOrigin,
        sortMode: input.sortMode,
        departureAt: input.departureAt,
        storeSettings: input.storeSettings,
        originSource: input.originSource,
        originLabel: input.originLabel,
      });
      const groupLabel = buildRouteGroupLabel(groupPlan.items, index, input.effectiveOrigin);
      const groupId = `group-${index + 1}`;
      const groupColor = ROUTE_GROUP_COLORS[index % ROUTE_GROUP_COLORS.length];

      return {
        id: groupId,
        label: groupLabel,
        color: groupColor,
        workerIndex: index + 1,
        items: groupPlan.items.map((item) => ({
          ...item,
          groupId,
          groupLabel,
          groupColor,
          workerIndex: index + 1,
        })),
        route: groupPlan.route,
        summary: {
          routeStopCount: groupPlan.summary.routeStopCount,
          routeDurationMinutes: groupPlan.summary.routeDurationMinutes,
          routeDriveMinutes: groupPlan.summary.routeDriveMinutes,
          routeServiceMinutes: groupPlan.summary.routeServiceMinutes,
          routeDistanceKm: groupPlan.summary.routeDistanceKm,
          effectiveWorkloadMinutes: groupPlan.summary.effectiveWorkloadMinutes,
        },
      };
    })
  );

  return groups.filter((group): group is DeliveryRouteGroup => group !== null);
}

async function buildDeliveryPlanningData(input: {
  items: PlanningItem[];
  effectiveOrigin: { lat: number; lng: number } | null;
  sortMode: PlanningSortMode;
  departureAt: Date;
  storeSettings: StoreSettingsDto;
  originSource: 'user' | 'store' | 'none';
  originLabel: string | null;
}): Promise<DeliveryPlanningData> {
  const operationalRouteLimitMinutes = getOperationalRouteLimitMinutes(input.storeSettings);

  const geocodedItems = await Promise.all(
    input.items.map(async (item, index): Promise<EnrichedPlanningItem> => {
      if (typeof item.lat === 'number' && typeof item.lng === 'number') {
        return {
          ...item,
          lat: item.lat,
          lng: item.lng,
          etaMinutes: null,
          distanceKm: null,
          originEtaMinutes: null,
          originDistanceKm: null,
          routeIndex: null,
          estimatedArrivalAt: null,
          estimatedCompletionAt: null,
          geocodeSource: 'existing',
          routeBucket: 'today',
          autoDeferredToDate: null,
          groupId: null,
          groupLabel: null,
          groupColor: null,
          workerIndex: null,
        };
      }

      if (index >= MAX_GEOCODED_ITEMS) {
        return {
          ...item,
          lat: null,
          lng: null,
          etaMinutes: null,
          distanceKm: null,
          originEtaMinutes: null,
          originDistanceKm: null,
          routeIndex: null,
          estimatedArrivalAt: null,
          estimatedCompletionAt: null,
          geocodeSource: 'missing',
          routeBucket: 'today',
          autoDeferredToDate: null,
          groupId: null,
          groupLabel: null,
          groupColor: null,
          workerIndex: null,
        };
      }

      const geocoded = await geocodeWithMapbox(item);
      return {
        ...item,
        lat: geocoded?.lat ?? null,
        lng: geocoded?.lng ?? null,
        etaMinutes: null,
        distanceKm: null,
        originEtaMinutes: null,
        originDistanceKm: null,
        routeIndex: null,
        estimatedArrivalAt: null,
        estimatedCompletionAt: null,
        geocodeSource: geocoded ? 'mapbox' : 'missing',
        routeBucket: 'today',
        autoDeferredToDate: null,
        groupId: null,
        groupLabel: null,
        groupColor: null,
        workerIndex: null,
      };
    })
  );

  const etaMap = await fetchOriginEtaMap(input.effectiveOrigin, geocodedItems);
  const enrichedItems = geocodedItems.map((item) => {
    const metrics = etaMap.get(item.id);
    return {
      ...item,
      etaMinutes: metrics?.etaMinutes ?? null,
      distanceKm: metrics?.distanceKm ?? null,
      originEtaMinutes: metrics?.etaMinutes ?? null,
      originDistanceKm: metrics?.distanceKm ?? null,
    };
  });

  const optimizedPlan =
    input.sortMode === 'smart'
      ? await fetchOptimizedRoutePlan(input.effectiveOrigin, enrichedItems, input.departureAt)
      : null;

  let sortedItems: EnrichedPlanningItem[];
  let route: RoutePlan['route'] | null;

  if (optimizedPlan) {
    const optimizedIds = new Set(optimizedPlan.orderedIds);
    const itemById = new Map(enrichedItems.map((item) => [item.id, item]));

    const optimizedItems = optimizedPlan.orderedIds
      .map((itemId) => {
        const baseItem = itemById.get(itemId);
        const metrics = optimizedPlan.metricsById.get(itemId);
        if (!baseItem || !metrics) return null;

        return {
          ...baseItem,
          etaMinutes: metrics.etaMinutes,
          distanceKm: metrics.distanceKm,
          routeIndex: metrics.routeIndex,
          estimatedArrivalAt: metrics.estimatedArrivalAt,
          estimatedCompletionAt: metrics.estimatedCompletionAt,
        };
      })
      .filter((item): item is EnrichedPlanningItem => item !== null);

    const remainingItems = sortEnrichedItems(
      enrichedItems.filter((item) => !optimizedIds.has(item.id)),
      'schedule'
    ).map((item) => ({
      ...item,
      routeIndex: null,
    }));

    sortedItems = [...optimizedItems, ...remainingItems];
    route = optimizedPlan.route;
  } else {
    sortedItems = sortEnrichedItems(enrichedItems, input.sortMode);
    const fallbackPlan = await fetchRouteGeometry(
      input.effectiveOrigin,
      sortedItems,
      input.departureAt
    );
    if (fallbackPlan) {
      sortedItems = sortedItems.map((item) => {
        const metrics = fallbackPlan.metricsById.get(item.id);
        if (!metrics) return item;

        return {
          ...item,
          etaMinutes: metrics.etaMinutes,
          distanceKm: metrics.distanceKm,
          routeIndex: metrics.routeIndex,
          estimatedArrivalAt: metrics.estimatedArrivalAt,
          estimatedCompletionAt: metrics.estimatedCompletionAt,
        };
      });
    }
    route = fallbackPlan?.route ?? null;
  }

  const summary = buildPlanningSummary({
    settings: input.storeSettings,
    route,
    items: sortedItems,
    hasOrigin: Boolean(input.effectiveOrigin),
    originSource: input.originSource,
    originLabel: input.originLabel,
    operationalRouteLimitMinutes,
  });

  return {
    items: sortedItems,
    summary: {
      ...summary,
      geocodedCount: sortedItems.filter((item) => item.geocodeSource === 'mapbox').length,
      etaCount: sortedItems.filter((item) => item.etaMinutes !== null).length,
    },
    route,
    origin: input.effectiveOrigin,
    deferred: null,
    routeGroups: [],
  };
}

export async function planDeliveryRoute(input: {
  items: PlanningItem[];
  origin?: { lat: number; lng: number } | null;
  sortMode?: PlanningSortMode;
  departureAt?: Date;
  storeSettings?: StoreSettingsDto;
  autoSplit?: boolean;
  grouping?: PlanningGrouping;
}): Promise<DeliveryPlanningData> {
  const storeSettings = input.storeSettings ?? (await getStoreSettings());
  const sortMode = input.sortMode ?? 'smart';
  const grouping = input.grouping ?? { strategy: 'none', workerCount: 1 };
  const storeOrigin = await resolveStoreOrigin(storeSettings);
  const effectiveOrigin = input.origin ?? storeOrigin.origin;
  const originSource = input.origin ? 'user' : storeOrigin.origin ? 'store' : 'none';
  const originLabel =
    originSource === 'store' ? storeOrigin.label : originSource === 'user' ? 'מיקום נוכחי' : null;
  const departureAt = input.departureAt ?? new Date();
  const operationalRouteLimitMinutes = getOperationalRouteLimitMinutes(storeSettings);

  const basePlan = await buildDeliveryPlanningData({
    items: input.items,
    effectiveOrigin,
    sortMode,
    departureAt,
    storeSettings,
    originSource,
    originLabel,
  });

  const preSplitWorkloadMinutes = basePlan.summary.effectiveWorkloadMinutes;
  const preSplitOperationalOverflowMinutes = Math.max(
    0,
    preSplitWorkloadMinutes - operationalRouteLimitMinutes
  );

  if (!input.autoSplit || preSplitOperationalOverflowMinutes <= 0) {
    const routeGroups = await buildGroupedDeliveryPlans({
      items: basePlan.items.filter((item) => item.routeBucket === 'today'),
      originalItems: input.items,
      grouping,
      effectiveOrigin,
      sortMode,
      departureAt,
      storeSettings,
      originSource,
      originLabel,
    });
    const groupedItems =
      routeGroups.length > 0
        ? [
            ...routeGroups.flatMap((group) => group.items),
            ...basePlan.items.filter((item) => item.routeBucket === 'tomorrow'),
          ]
        : basePlan.items;

    return {
      ...basePlan,
      items: groupedItems,
      summary: {
        ...basePlan.summary,
        preSplitWorkloadMinutes,
        preSplitOperationalOverflowMinutes,
        groupingStrategy: grouping.strategy,
        requestedWorkerCount: grouping.workerCount,
        activeWorkerCount: routeGroups.length || 1,
        zoneSplitApplied: routeGroups.length > 0,
      },
      routeGroups,
    };
  }

  const autoDeferredCandidates = pickAutoDeferredCandidates(basePlan.items);
  const todayDateKey = getBusinessDayDateKey(departureAt, storeSettings.timezone);
  const deferredDateKey = addDaysToDateKey(todayDateKey, 1);
  const deferredDepartureAt = getBusinessDayStartUtcForDateKey(deferredDateKey, storeSettings);

  for (let count = 1; count <= autoDeferredCandidates.length; count += 1) {
    const deferredIds = new Set(autoDeferredCandidates.slice(0, count).map((item) => item.id));
    const todayItems = input.items.filter((item) => !deferredIds.has(item.id));
    const deferredItems = input.items.filter((item) => deferredIds.has(item.id));

    if (!todayItems.length || !deferredItems.length) {
      continue;
    }

    const todayPlan = await buildDeliveryPlanningData({
      items: todayItems,
      effectiveOrigin,
      sortMode,
      departureAt,
      storeSettings,
      originSource,
      originLabel,
    });

    if (todayPlan.summary.exceedsOperationalLimit || todayPlan.summary.exceedsBusinessHours) {
      continue;
    }

    const deferredPlan = await buildDeliveryPlanningData({
      items: deferredItems,
      effectiveOrigin,
      sortMode,
      departureAt: deferredDepartureAt,
      storeSettings,
      originSource,
      originLabel,
    });

    if (deferredPlan.summary.exceedsOperationalLimit || deferredPlan.summary.exceedsBusinessHours) {
      break;
    }

    const routeGroups = await buildGroupedDeliveryPlans({
      items: todayPlan.items.filter((item) => item.routeBucket === 'today'),
      originalItems: todayItems,
      grouping,
      effectiveOrigin,
      sortMode,
      departureAt,
      storeSettings,
      originSource,
      originLabel,
    });

    const groupedTodayItems =
      routeGroups.length > 0 ? routeGroups.flatMap((group) => group.items) : todayPlan.items;
    const markedDeferredItems = deferredPlan.items.map((item) => ({
      ...item,
      routeBucket: 'tomorrow' as const,
      autoDeferredToDate: deferredDateKey,
    }));

    return {
      items: [...groupedTodayItems, ...markedDeferredItems],
      summary: {
        ...todayPlan.summary,
        preSplitWorkloadMinutes,
        preSplitOperationalOverflowMinutes,
        autoSplitApplied: true,
        deferredStopCount: markedDeferredItems.length,
        deferredDateKey,
        deferredWorkloadMinutes: deferredPlan.summary.effectiveWorkloadMinutes,
        groupingStrategy: grouping.strategy,
        requestedWorkerCount: grouping.workerCount,
        activeWorkerCount: routeGroups.length || 1,
        zoneSplitApplied: routeGroups.length > 0,
      },
      route: todayPlan.route,
      origin: todayPlan.origin,
      deferred: {
        dateKey: deferredDateKey,
        items: markedDeferredItems,
        route: deferredPlan.route,
        summary: buildDeferredPlanSummary(deferredPlan),
      },
      routeGroups,
    };
  }

  const routeGroups = await buildGroupedDeliveryPlans({
    items: basePlan.items.filter((item) => item.routeBucket === 'today'),
    originalItems: input.items,
    grouping,
    effectiveOrigin,
    sortMode,
    departureAt,
    storeSettings,
    originSource,
    originLabel,
  });

  return {
    ...basePlan,
    items:
      routeGroups.length > 0
        ? [
            ...routeGroups.flatMap((group) => group.items),
            ...basePlan.items.filter((item) => item.routeBucket === 'tomorrow'),
          ]
        : basePlan.items,
    summary: {
      ...basePlan.summary,
      preSplitWorkloadMinutes,
      preSplitOperationalOverflowMinutes,
      groupingStrategy: grouping.strategy,
      requestedWorkerCount: grouping.workerCount,
      activeWorkerCount: routeGroups.length || 1,
      zoneSplitApplied: routeGroups.length > 0,
    },
    routeGroups,
  };
}

export function isDeliveryPlanningConfigured() {
  return hasMapboxAccessToken();
}
