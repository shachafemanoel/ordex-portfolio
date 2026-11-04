import { FulfillmentType } from '@prisma/client';

import { prisma } from '@/lib/db';
import { planDeliveryRoute } from '@/lib/delivery-route-planning';
import {
  ACTIVE_DELIVERY_STATUSES,
  buildCandidatePlanningItem,
  buildPlanningItemFromOrder,
  type ScheduleAddress,
} from '@/lib/orders/deliveryScheduling';
import { DomainError } from '@/lib/server/errors';
import {
  getBusinessDayUtcRange,
  getBusinessHoursLabel,
  isBusinessTimeRangeWithinHours,
  resolveScheduleTimeRange,
} from '@/lib/store-business-hours';
import { getStoreSettings } from '@/lib/store-settings';

export type ScheduleCapacityResult = {
  businessDay: {
    dateKey: string;
    startUtc: Date;
    endUtc: Date;
  };
  storeSettings: Awaited<ReturnType<typeof getStoreSettings>>;
  summary: Awaited<ReturnType<typeof planDeliveryRoute>>['summary'];
  deferredOrders: Array<{
    id: string;
    number: string;
    deferredDateKey: string | null;
  }>;
};

export async function assertScheduleWithinDeliveryCapacity(
  input: {
    orderId: string;
    orderNumber: string;
    currentStatus: string;
    scheduledAt: Date;
    scheduledEnd?: Date | null;
    timeWindowStart?: string | null;
    timeWindowEnd?: string | null;
    durationMinutes?: number | null;
    fulfillmentType?: FulfillmentType | null;
    address: ScheduleAddress | null;
    fallbackAddressLine: string | null;
    fallbackCity: string | null;
    fallbackLat: number | null;
    fallbackLng: number | null;
  },
  options?: {
    autoRebalance?: boolean;
  }
): Promise<ScheduleCapacityResult> {
  const storeSettings = await getStoreSettings();
  const businessHoursLabel = getBusinessHoursLabel(storeSettings);
  const scheduleRange = resolveScheduleTimeRange({
    scheduledAt: input.scheduledAt,
    scheduledEnd: input.scheduledEnd ?? null,
    timeWindowStart: input.timeWindowStart ?? null,
    timeWindowEnd: input.timeWindowEnd ?? null,
    durationMinutes: input.durationMinutes ?? null,
    timezone: storeSettings.timezone,
  });

  if (
    !isBusinessTimeRangeWithinHours(scheduleRange.startTime, scheduleRange.endTime, storeSettings)
  ) {
    throw new DomainError('schedule_outside_business_hours', 400, {
      message: `חלון התיאום ${scheduleRange.startTime}-${scheduleRange.endTime} חורג משעות העבודה של העסק (${businessHoursLabel}).`,
      businessDayStartTime: storeSettings.businessDayStartTime,
      businessDayEndTime: storeSettings.businessDayEndTime,
      scheduledDate: scheduleRange.dateKey,
      scheduledWindow: `${scheduleRange.startTime}-${scheduleRange.endTime}`,
    });
  }

  const businessDay = getBusinessDayUtcRange(input.scheduledAt, storeSettings);
  const dailyOrders = await prisma.order.findMany({
    where: {
      id: { not: input.orderId },
      deletedAt: null,
      status: {
        in: [...ACTIVE_DELIVERY_STATUSES],
      },
      scheduledAt: {
        gte: businessDay.startUtc,
        lt: businessDay.endUtc,
      },
    },
    select: {
      id: true,
      number: true,
      status: true,
      scheduledAt: true,
      durationOverrideMinutes: true,
      fulfillmentType: true,
      addressLine: true,
      city: true,
      lat: true,
      lng: true,
      latitude: true,
      longitude: true,
      shippingAddress: {
        select: {
          city: true,
          street: true,
          number: true,
          lat: true,
          lng: true,
        },
      },
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
  });

  const planningItems = [
    ...dailyOrders.map((order) => buildPlanningItemFromOrder(order)),
    buildCandidatePlanningItem({
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      status: input.currentStatus,
      scheduledAt: input.scheduledAt,
      address: input.address,
      fallbackAddressLine: input.fallbackAddressLine,
      fallbackCity: input.fallbackCity,
      fallbackLat: input.fallbackLat,
      fallbackLng: input.fallbackLng,
      durationMinutes: input.durationMinutes,
      fulfillmentType: input.fulfillmentType,
    }),
  ];

  const planning = await planDeliveryRoute({
    items: planningItems,
    sortMode: 'smart',
    departureAt: businessDay.startUtc,
    storeSettings,
    autoSplit: options?.autoRebalance ?? false,
  });

  if (planning.summary.exceedsBusinessHours || planning.summary.exceedsOperationalLimit) {
    const overflowMinutes = planning.summary.exceedsBusinessHours
      ? planning.summary.overflowMinutes
      : planning.summary.operationalOverflowMinutes;
    const limitLabel = planning.summary.exceedsBusinessHours
      ? `שעות העבודה (${businessHoursLabel})`
      : `תקרת המסלול היומית (${Math.round(planning.summary.operationalRouteLimitMinutes / 60)} שעות)`;

    throw new DomainError('delivery_capacity_exceeded', 409, {
      message: `לא ניתן לתאם ל-${businessDay.dateKey}. המסלול היומי מוערך ב-${planning.summary.effectiveWorkloadMinutes} דקות וחורג ב-${overflowMinutes} דקות מ-${limitLabel}.`,
      scheduledDate: businessDay.dateKey,
      routeDurationMinutes: planning.summary.routeDurationMinutes,
      effectiveWorkloadMinutes: planning.summary.effectiveWorkloadMinutes,
      businessDayAvailableMinutes: planning.summary.businessDayAvailableMinutes,
      overflowMinutes,
      businessDayStartTime: planning.summary.businessDayStartTime,
      businessDayEndTime: planning.summary.businessDayEndTime,
      operationalRouteLimitMinutes: planning.summary.operationalRouteLimitMinutes,
      routeStopCount: planning.summary.routeStopCount,
    });
  }

  return {
    businessDay,
    storeSettings,
    summary: planning.summary,
    deferredOrders:
      planning.deferred?.items.map((item) => ({
        id: item.id,
        number: item.number ?? item.id,
        deferredDateKey: item.autoDeferredToDate,
      })) ?? [],
  };
}
