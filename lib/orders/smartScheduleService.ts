import { prisma } from '@/lib/db';
import {
  getOperationalRouteLimitMinutes,
  planDeliveryRoute,
  type EnrichedPlanningItem,
} from '@/lib/delivery-route-planning';
import {
  ACTIVE_DELIVERY_STATUSES,
  buildCandidatePlanningItem,
  buildPlanningItemFromOrder,
  resolveScheduleAddress,
} from '@/lib/orders/deliveryScheduling';
import {
  buildScheduleRecommendationCopy,
  buildScheduleRecommendationScore,
  buildSmartScheduleWindowOptions,
  estimateScheduleInsertionMinutes,
  matchSmartScheduleWindow,
  type SmartScheduleManualDateOption,
  type SmartScheduleRecommendation,
  type SmartScheduleWindowOption,
} from '@/lib/orders/smartSchedule';
import {
  addDaysToDateKey,
  getBusinessDayDateKey,
  getBusinessDayDurationMinutes,
  getBusinessDayStartUtcForDateKey,
  getBusinessHoursLabel,
  getZonedTimeString,
} from '@/lib/store-business-hours';
import { getStoreSettings } from '@/lib/store-settings';
import { FulfillmentType } from '@prisma/client';
import { zonedTimeToUtc } from 'date-fns-tz';

const MIN_LEAD_TIME_MS = 2 * 60 * 60 * 1000;
const DEFAULT_LOOKAHEAD_DAYS = 6;
const DEFAULT_RECOMMENDATION_LIMIT = 4;

type SmartScheduleOrderRecord = {
  id: string;
  number: string;
  status: string;
  scheduledAt: Date | null;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  durationOverrideMinutes: number | null;
  fulfillmentType: FulfillmentType | null;
  addressLine: string | null;
  city: string | null;
  street: string | null;
  houseNumber: string | null;
  floor: string | null;
  apartment: string | null;
  lat: number | null;
  lng: number | null;
  latitude: number | null;
  longitude: number | null;
  shippingAddress: {
    city: string | null;
    street: string | null;
    number: string | null;
    floor: string | null;
    notes: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
};

type CandidateWindowMetrics = {
  id: string;
  dateValue: string;
  window: SmartScheduleWindowOption;
  score: number;
  loadCount: number;
  dayLoadCount: number;
  nearestClusterDistanceKm: number | null;
  projectedWorkloadMinutes: number;
  remainingCapacityMinutes: number;
  insertionMinutes: number;
  disabled: boolean;
  reason: string | null;
};

function clampInteger(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
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

function resolveExistingOrderWindow(
  order: Pick<SmartScheduleOrderRecord, 'scheduledAt' | 'timeWindowStart'>,
  windowOptions: SmartScheduleWindowOption[],
  timezone: string
) {
  if (order.timeWindowStart) {
    return matchSmartScheduleWindow(order.timeWindowStart, windowOptions);
  }

  if (!order.scheduledAt) {
    return null;
  }

  return matchSmartScheduleWindow(getZonedTimeString(order.scheduledAt, timezone), windowOptions);
}

function getNearestClusterDistanceKm(
  candidate: Pick<EnrichedPlanningItem, 'lat' | 'lng' | 'originDistanceKm'> | null,
  neighbors: Array<{ metrics: Pick<EnrichedPlanningItem, 'lat' | 'lng'> | null }>
) {
  if (!candidate || typeof candidate.lat !== 'number' || typeof candidate.lng !== 'number') {
    return candidate?.originDistanceKm ?? null;
  }

  const candidateCoordinates = { lat: candidate.lat, lng: candidate.lng };
  const distances = neighbors
    .map((neighbor) => neighbor.metrics)
    .filter(
      (metrics): metrics is Pick<EnrichedPlanningItem, 'lat' | 'lng'> & { lat: number; lng: number } =>
        metrics !== null && typeof metrics.lat === 'number' && typeof metrics.lng === 'number'
    )
    .map((metrics) => haversineDistanceKm(candidateCoordinates, metrics));

  if (!distances.length) {
    return candidate.originDistanceKm ?? null;
  }

  return Number(Math.min(...distances).toFixed(1));
}

function buildDisabledReason(input: {
  slotStart: Date;
  now: Date;
  remainingCapacityMinutes: number;
  businessHoursLabel: string;
}) {
  if (input.slotStart.getTime() - input.now.getTime() < MIN_LEAD_TIME_MS) {
    return 'החלון קרוב מדי לזמן הנוכחי לתיאום ותפעול.';
  }

  if (input.remainingCapacityMinutes < 0) {
    return `המסלול של היום חורג מהקיבולת הזמינה (${input.businessHoursLabel}).`;
  }

  return null;
}

function buildRecommendationDateRange(firstDateKey: string, lookaheadDays: number) {
  return Array.from({ length: lookaheadDays }, (_, index) =>
    addDaysToDateKey(firstDateKey, index)
  );
}

export async function getSmartScheduleRecommendationsForOrder(input: {
  orderId: string;
  now?: Date;
  lookaheadDays?: number;
  limit?: number;
}) {
  const now = input.now ?? new Date();
  const lookaheadDays = clampInteger(input.lookaheadDays, 3, 10, DEFAULT_LOOKAHEAD_DAYS);
  const limit = clampInteger(input.limit, 2, 6, DEFAULT_RECOMMENDATION_LIMIT);
  const storeSettings = await getStoreSettings();
  const windowOptions = buildSmartScheduleWindowOptions(storeSettings);
  const businessHoursLabel = getBusinessHoursLabel(storeSettings);
  const operationalRouteLimitMinutes = getOperationalRouteLimitMinutes(storeSettings);
  const capacityLimitMinutes = Math.min(
    getBusinessDayDurationMinutes(storeSettings),
    operationalRouteLimitMinutes
  );
  const firstDateKey = getBusinessDayDateKey(now, storeSettings.timezone);
  const dateKeys = buildRecommendationDateRange(firstDateKey, lookaheadDays);
  const rangeStart = getBusinessDayStartUtcForDateKey(firstDateKey, storeSettings);
  const rangeEnd = getBusinessDayStartUtcForDateKey(
    addDaysToDateKey(firstDateKey, lookaheadDays),
    storeSettings
  );

  const [order, upcomingOrders] = await Promise.all([
    prisma.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        number: true,
        status: true,
        scheduledAt: true,
        timeWindowStart: true,
        timeWindowEnd: true,
        durationOverrideMinutes: true,
        fulfillmentType: true,
        addressLine: true,
        city: true,
        street: true,
        houseNumber: true,
        floor: true,
        apartment: true,
        lat: true,
        lng: true,
        latitude: true,
        longitude: true,
        shippingAddress: {
          select: {
            city: true,
            street: true,
            number: true,
            floor: true,
            notes: true,
            lat: true,
            lng: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        id: { not: input.orderId },
        deletedAt: null,
        status: { in: [...ACTIVE_DELIVERY_STATUSES] },
        scheduledAt: {
          gte: rangeStart,
          lt: rangeEnd,
        },
      },
      select: {
        id: true,
        number: true,
        status: true,
        scheduledAt: true,
        timeWindowStart: true,
        timeWindowEnd: true,
        durationOverrideMinutes: true,
        fulfillmentType: true,
        addressLine: true,
        city: true,
        street: true,
        houseNumber: true,
        floor: true,
        apartment: true,
        lat: true,
        lng: true,
        latitude: true,
        longitude: true,
        shippingAddress: {
          select: {
            city: true,
            street: true,
            number: true,
            floor: true,
            notes: true,
            lat: true,
            lng: true,
          },
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  if (!order) {
    throw new Error('Order not found');
  }

  const candidateSeedAt = getBusinessDayStartUtcForDateKey(firstDateKey, storeSettings);
  const candidatePlanningItem = buildCandidatePlanningItem({
    orderId: order.id,
    orderNumber: order.number,
    status: String(order.status ?? 'READY'),
    scheduledAt: candidateSeedAt,
    address: resolveScheduleAddress(order),
    fallbackAddressLine:
      order.addressLine ||
      (order.shippingAddress
        ? [order.shippingAddress.street, order.shippingAddress.number].filter(Boolean).join(' ')
        : null),
    fallbackCity: order.city ?? order.shippingAddress?.city ?? null,
    fallbackLat: order.lat ?? order.latitude ?? order.shippingAddress?.lat ?? null,
    fallbackLng: order.lng ?? order.longitude ?? order.shippingAddress?.lng ?? null,
    durationMinutes: order.durationOverrideMinutes,
    fulfillmentType: order.fulfillmentType,
  });
  const candidatePlan = await planDeliveryRoute({
    items: [candidatePlanningItem],
    departureAt: candidateSeedAt,
    storeSettings,
    sortMode: 'smart',
  });
  const candidate = candidatePlan.items[0] ?? null;
  const sharedOrigin = candidatePlan.origin ?? undefined;

  const ordersByDate = new Map<string, SmartScheduleOrderRecord[]>();
  for (const upcomingOrder of upcomingOrders as SmartScheduleOrderRecord[]) {
    if (!upcomingOrder.scheduledAt) continue;
    const dateKey = getBusinessDayDateKey(upcomingOrder.scheduledAt, storeSettings.timezone);
    const current = ordersByDate.get(dateKey) ?? [];
    current.push(upcomingOrder);
    ordersByDate.set(dateKey, current);
  }

  const dayContexts = await Promise.all(
    dateKeys.map(async (dateKey) => {
      const dayOrders = ordersByDate.get(dateKey) ?? [];

      if (!dayOrders.length) {
        return {
          dateKey,
          baseWorkloadMinutes: 0,
          dayOrders: [] as Array<{
            order: SmartScheduleOrderRecord;
            metrics: EnrichedPlanningItem | null;
            windowValue: string | null;
          }>,
        };
      }

      const departureAt = getBusinessDayStartUtcForDateKey(dateKey, storeSettings);
      const dayPlan = await planDeliveryRoute({
        items: dayOrders.map((dayOrder) => buildPlanningItemFromOrder(dayOrder)),
        departureAt,
        origin: sharedOrigin,
        storeSettings,
        sortMode: 'smart',
      });
      const metricsById = new Map(dayPlan.items.map((item) => [item.id, item]));

      return {
        dateKey,
        baseWorkloadMinutes: dayPlan.summary.effectiveWorkloadMinutes,
        dayOrders: dayOrders.map((dayOrder) => ({
          order: dayOrder,
          metrics: metricsById.get(dayOrder.id) ?? null,
          windowValue:
            resolveExistingOrderWindow(dayOrder, windowOptions, storeSettings.timezone)?.value ??
            null,
        })),
      };
    })
  );

  const candidateServiceMinutes =
    typeof candidatePlanningItem.serviceMinutes === 'number'
      ? candidatePlanningItem.serviceMinutes
      : 60;

  const rankedCandidates = dayContexts
    .flatMap((dayContext, dayIndex) =>
      windowOptions.map((windowOption): CandidateWindowMetrics => {
        const slotStart = zonedTimeToUtc(
          `${dayContext.dateKey} ${windowOption.start}:00`,
          storeSettings.timezone
        );
        const sameWindowOrders = dayContext.dayOrders.filter(
          (dayOrder) => dayOrder.windowValue === windowOption.value
        );
        const nearestClusterDistanceKm = getNearestClusterDistanceKm(
          candidate,
          sameWindowOrders.length > 0 ? sameWindowOrders : dayContext.dayOrders
        );
        const insertionMinutes = estimateScheduleInsertionMinutes({
          nearestClusterDistanceKm,
          candidateOriginDistanceKm: candidate?.originDistanceKm ?? null,
          sameDayStopCount: dayContext.dayOrders.length,
          sameWindowStopCount: sameWindowOrders.length,
        });
        const projectedWorkloadMinutes =
          dayContext.baseWorkloadMinutes + candidateServiceMinutes + insertionMinutes;
        const remainingCapacityMinutes = capacityLimitMinutes - projectedWorkloadMinutes;
        const disabledReason = buildDisabledReason({
          slotStart,
          now,
          remainingCapacityMinutes,
          businessHoursLabel,
        });

        return {
          id: `${dayContext.dateKey}__${windowOption.value}`,
          dateValue: dayContext.dateKey,
          window: windowOption,
          score: buildScheduleRecommendationScore({
            dayOffset: dayIndex,
            windowPart: windowOption.part,
            sameDayStopCount: dayContext.dayOrders.length,
            sameWindowStopCount: sameWindowOrders.length,
            nearestClusterDistanceKm,
            projectedWorkloadMinutes,
            remainingCapacityMinutes,
            capacityLimitMinutes,
          }),
          loadCount: sameWindowOrders.length,
          dayLoadCount: dayContext.dayOrders.length,
          nearestClusterDistanceKm,
          projectedWorkloadMinutes,
          remainingCapacityMinutes,
          insertionMinutes,
          disabled: Boolean(disabledReason),
          reason: disabledReason,
        };
      })
    )
    .sort((left, right) => left.score - right.score);

  const recommendations: SmartScheduleRecommendation[] = rankedCandidates
    .filter((candidateWindow) => !candidateWindow.disabled)
    .slice(0, limit)
    .map((candidateWindow) => {
      const copy = buildScheduleRecommendationCopy({
        dayOffset: dateKeys.indexOf(candidateWindow.dateValue),
        sameDayStopCount: candidateWindow.dayLoadCount,
        sameWindowStopCount: candidateWindow.loadCount,
        nearestClusterDistanceKm: candidateWindow.nearestClusterDistanceKm,
        remainingCapacityMinutes: candidateWindow.remainingCapacityMinutes,
      });

      return {
        id: candidateWindow.id,
        title: copy.title,
        hint: copy.hint,
        dateValue: candidateWindow.dateValue,
        windowValue: candidateWindow.window.value,
        windowLabel: candidateWindow.window.label,
        windowStart: candidateWindow.window.start,
        windowEnd: candidateWindow.window.end,
        part: candidateWindow.window.part,
        loadCount: candidateWindow.loadCount,
        dayLoadCount: candidateWindow.dayLoadCount,
        nearestClusterDistanceKm: candidateWindow.nearestClusterDistanceKm,
        projectedWorkloadMinutes: candidateWindow.projectedWorkloadMinutes,
        remainingCapacityMinutes: candidateWindow.remainingCapacityMinutes,
        insertionMinutes: candidateWindow.insertionMinutes,
        score: candidateWindow.score,
      };
    });

  const recommendedIds = new Set(recommendations.map((recommendation) => recommendation.id));
  const dates: SmartScheduleManualDateOption[] = dateKeys.map((dateKey) => ({
    dateValue: dateKey,
    windowOptions: rankedCandidates
      .filter((candidateWindow) => candidateWindow.dateValue === dateKey)
      .map((candidateWindow) => ({
        value: candidateWindow.window.value,
        label: candidateWindow.window.label,
        start: candidateWindow.window.start,
        end: candidateWindow.window.end,
        loadCount: candidateWindow.loadCount,
        dayLoadCount: candidateWindow.dayLoadCount,
        nearestClusterDistanceKm: candidateWindow.nearestClusterDistanceKm,
        projectedWorkloadMinutes: candidateWindow.projectedWorkloadMinutes,
        remainingCapacityMinutes: candidateWindow.remainingCapacityMinutes,
        insertionMinutes: candidateWindow.insertionMinutes,
        disabled: candidateWindow.disabled,
        reason: candidateWindow.reason,
        isRecommended: recommendedIds.has(candidateWindow.id),
      })),
  }));

  return {
    recommendations,
    dates,
    businessHours: {
      label: businessHoursLabel,
      start: storeSettings.businessDayStartTime,
      end: storeSettings.businessDayEndTime,
      timezone: storeSettings.timezone,
      capacityLimitMinutes,
      operationalRouteLimitMinutes,
    },
  };
}
