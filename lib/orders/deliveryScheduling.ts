import type { PlanningItem } from '@/lib/delivery-route-planning';
import { FulfillmentType } from '@prisma/client';

export const ACTIVE_DELIVERY_STATUSES = [
  'READY',
  'READY_FOR_INSTALL',
  'INSTALL_SCHEDULING',
  'AWAITING_INSTALL',
  'SCHEDULED',
  'IN_TRANSIT',
  'INSTALLATION',
] as const;

const DEFAULT_SERVICE_MINUTES = 60;

export type ScheduleAddress = {
  city: string;
  street: string;
  number: string;
  floor?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  apartment?: string | null;
};

type ScheduleAddressOrderLike = {
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

type PlanningOrderLike = {
  id: string;
  number: string;
  status: string;
  scheduledAt: Date | null;
  durationOverrideMinutes: number | null;
  fulfillmentType: FulfillmentType | null;
  addressLine: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  latitude: number | null;
  longitude: number | null;
  shippingAddress: {
    city: string | null;
    street: string | null;
    number: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
};

function buildAddressLine(address: Pick<ScheduleAddress, 'street' | 'number'> | null) {
  if (!address) return null;
  return `${address.street} ${address.number}`.trim();
}

export function getPlanningServiceMinutes(
  durationOverrideMinutes: number | null | undefined,
  fulfillmentType: FulfillmentType | null | undefined
) {
  if (typeof durationOverrideMinutes === 'number' && Number.isFinite(durationOverrideMinutes)) {
    return Math.max(1, Math.round(durationOverrideMinutes));
  }

  if (fulfillmentType === FulfillmentType.PICKUP) {
    return 30;
  }

  return DEFAULT_SERVICE_MINUTES;
}

export function resolveScheduleAddress(
  order: ScheduleAddressOrderLike,
  payloadAddress?: Omit<ScheduleAddress, 'apartment'>
): ScheduleAddress | null {
  const city = payloadAddress?.city ?? order.shippingAddress?.city ?? order.city ?? undefined;
  const street = payloadAddress?.street ?? order.shippingAddress?.street ?? order.street ?? undefined;
  const number =
    payloadAddress?.number ?? order.shippingAddress?.number ?? order.houseNumber ?? undefined;

  if (!city || !street || !number) {
    return null;
  }

  return {
    city,
    street,
    number,
    floor: payloadAddress?.floor ?? order.shippingAddress?.floor ?? order.floor ?? undefined,
    notes: payloadAddress?.notes ?? order.shippingAddress?.notes ?? undefined,
    lat:
      payloadAddress?.lat ?? order.shippingAddress?.lat ?? order.lat ?? order.latitude ?? undefined,
    lng:
      payloadAddress?.lng ??
      order.shippingAddress?.lng ??
      order.lng ??
      order.longitude ??
      undefined,
    apartment: order.apartment ?? undefined,
  };
}

export function buildPlanningItemFromOrder(order: PlanningOrderLike): PlanningItem {
  const addressLine =
    order.addressLine ||
    [order.shippingAddress?.street, order.shippingAddress?.number].filter(Boolean).join(' ') ||
    null;

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    scheduledAt: order.scheduledAt?.toISOString() ?? null,
    serviceMinutes: getPlanningServiceMinutes(
      order.durationOverrideMinutes,
      order.fulfillmentType ?? undefined
    ),
    addressLine,
    city: order.city ?? order.shippingAddress?.city ?? null,
    lat: order.lat ?? order.latitude ?? order.shippingAddress?.lat ?? null,
    lng: order.lng ?? order.longitude ?? order.shippingAddress?.lng ?? null,
  };
}

export function buildCandidatePlanningItem(input: {
  orderId: string;
  orderNumber: string;
  status: string;
  scheduledAt: Date;
  address: ScheduleAddress | null;
  fallbackAddressLine: string | null;
  fallbackCity: string | null;
  fallbackLat: number | null;
  fallbackLng: number | null;
  durationMinutes?: number | null;
  fulfillmentType?: FulfillmentType | null;
}): PlanningItem {
  return {
    id: input.orderId,
    number: input.orderNumber,
    status: input.status,
    scheduledAt: input.scheduledAt.toISOString(),
    serviceMinutes: getPlanningServiceMinutes(input.durationMinutes, input.fulfillmentType),
    addressLine: buildAddressLine(input.address) ?? input.fallbackAddressLine,
    city: input.address?.city ?? input.fallbackCity,
    lat: input.address?.lat ?? input.fallbackLat,
    lng: input.address?.lng ?? input.fallbackLng,
  };
}
