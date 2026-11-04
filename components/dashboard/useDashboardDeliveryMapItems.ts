'use client';

import type { DeliveryMapPoint } from '@/components/ops/shared/DeliveriesMapboxCanvas';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { buildDeliveryMapHotspots, buildDeliveryMapInsights } from '@/lib/delivery-map-insights';
import { useOrdersQuery } from '@/lib/hooks/api/orders';
import { useMemo } from 'react';

type DashboardDeliveryStatus =
  | 'COMPLETED'
  | 'READY'
  | 'READY_FOR_INSTALL'
  | 'INSTALL_SCHEDULING'
  | 'AWAITING_INSTALL'
  | 'SCHEDULED'
  | 'IN_TRANSIT'
  | 'INSTALLATION';

const DASHBOARD_MAP_STATUSES: DashboardDeliveryStatus[] = [
  'READY',
  'READY_FOR_INSTALL',
  'INSTALL_SCHEDULING',
  'AWAITING_INSTALL',
  'SCHEDULED',
  'IN_TRANSIT',
  'INSTALLATION',
  'COMPLETED',
];

const MAX_MAP_ITEMS = 80;

interface DashboardDeliveryOrderData {
  id: string;
  number: string;
  status: string;
  customer?: { name?: string | null; phone?: string | null } | null;
  customerName?: string | null;
  city?: string | null;
  addressLine?: string | null;
  address?: string | null;
  shippingAddress?: {
    addressLine?: string | null;
    street?: string | null;
    number?: string | null;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
    coordinates?: { lat?: number | null; lng?: number | null } | null;
  } | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

function mapOrderToDeliveryItem(order: DashboardDeliveryOrderData): DeliveryMapPoint {
  const lat =
    order.lat ??
    order.latitude ??
    order.shippingAddress?.lat ??
    order.shippingAddress?.coordinates?.lat ??
    null;
  const lng =
    order.lng ??
    order.longitude ??
    order.shippingAddress?.lng ??
    order.shippingAddress?.coordinates?.lng ??
    null;

  const completedAt = order.completedAt ? new Date(order.completedAt) : null;
  const updatedAt = order.updatedAt ? new Date(order.updatedAt) : null;
  const completedDate =
    completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : updatedAt;
  const isCompletedToday =
    order.status === 'COMPLETED' &&
    completedDate != null &&
    completedDate.toDateString() === new Date().toDateString();
  const isPlannedToday =
    !isCompletedToday &&
    typeof order.scheduledAt === 'string' &&
    !Number.isNaN(new Date(order.scheduledAt).getTime()) &&
    new Date(order.scheduledAt).toDateString() === new Date().toDateString();

  return {
    id: order.id,
    number: order.number,
    customerName:
      order.customer?.name?.trim() || order.customerName?.trim() || DISPLAY_TEXT.unknownCustomer,
    status: order.status,
    addressLine:
      order.addressLine ||
      order.address ||
      order.shippingAddress?.addressLine ||
      [order.shippingAddress?.street, order.shippingAddress?.number].filter(Boolean).join(' ') ||
      DISPLAY_TEXT.noAddress,
    city: order.city ?? order.shippingAddress?.city ?? null,
    scheduledAt: order.scheduledAt ?? null,
    lat,
    lng,
    etaMinutes: null,
    distanceKm: null,
    routeIndex: null,
    geocodeSource: typeof lat === 'number' && typeof lng === 'number' ? 'existing' : 'missing',
    markerTone: isCompletedToday ? 'completed-today' : isPlannedToday ? 'planned-today' : undefined,
  };
}

export function useDashboardDeliveryMapItems() {
  const { data, isLoading } = useOrdersQuery({
    filters: {
      status: DASHBOARD_MAP_STATUSES,
      limit: MAX_MAP_ITEMS,
      includeItems: false,
      sort: 'updatedAt',
      dir: 'desc',
    },
    options: {
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    },
  });

  const items = useMemo(() => {
    const rawItems = data?.items && Array.isArray(data.items) ? data.items : [];

    return rawItems
      .map((item: DashboardDeliveryOrderData) => mapOrderToDeliveryItem(item))
      .slice(0, MAX_MAP_ITEMS)
      .sort((left, right) => {
        const leftTime = left.scheduledAt
          ? new Date(left.scheduledAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        const rightTime = right.scheduledAt
          ? new Date(right.scheduledAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime;
      });
  }, [data?.items]);

  const hotspots = useMemo(
    () =>
      buildDeliveryMapHotspots(items, {
        maxHotspots: 6,
      }),
    [items]
  );

  const insights = useMemo(
    () =>
      buildDeliveryMapInsights(
        {
          items,
          hotspots,
        },
        {
          maxInsights: 3,
        }
      ),
    [hotspots, items]
  );

  return {
    items,
    hotspots,
    insights,
    isLoading,
  };
}
