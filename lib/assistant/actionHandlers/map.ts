import { z } from 'zod';
import { prisma } from '@/lib/db';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import type { ActionDefinition } from '@/lib/assistant/actionRegistry';
import type { NextSuggestion } from '@/lib/assistant/uiPayloadSchema';
import { DEFAULT_ACTION_SUGGESTIONS } from '@/lib/assistant/suggestions';

const mapParamsSchema = z.object({
  status: z.union([z.string(), z.array(z.string())]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

const mapOrdersByStatusAction: ActionDefinition<typeof mapParamsSchema> = {
  id: 'map.orders_by_status',
  paramsSchema: mapParamsSchema,
  handler: async (params) => {
    const normalizedStatuses = params.status
      ? (Array.isArray(params.status) ? params.status : [params.status]).map((s) => normalizeOrderStatus(s))
      : undefined;

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { lat: { not: null } },
          { lng: { not: null } },
          { latitude: { not: null } },
          { longitude: { not: null } },
        ],
        ...(normalizedStatuses ? { status: { in: normalizedStatuses } } : {}),
      },
      select: {
        id: true,
        number: true,
        status: true,
        city: true,
        customerName: true,
        totalCents: true,
        lat: true,
        lng: true,
        latitude: true,
        longitude: true,
        addressLine: true,
        scheduledAt: true,
      },
      take: params.limit ?? 200,
      orderBy: { updatedAt: 'desc' },
    });

    const pins = orders
      .map((order) => {
        const lat = order.latitude ?? order.lat;
        const lng = order.longitude ?? order.lng;
        if (lat === null || lng === null || lat === undefined || lng === undefined) return null;

        const normalized = normalizeOrderStatus(order.status);
        return {
          id: order.id,
          lat,
          lng,
          label: order.number ?? order.id,
          status: normalized,
          city: order.city ?? undefined,
          orderNumber: order.number ?? undefined,
          customerName: order.customerName ?? undefined,
          amount: Number((order.totalCents ?? 0) / 100),
          scheduledAt: order.scheduledAt?.toISOString?.() ?? undefined,
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        lat: number;
        lng: number;
        label: string;
        status: string;
        city?: string;
        orderNumber?: string;
        customerName?: string;
        amount?: number;
        scheduledAt?: string;
      }>;

    const suggestions: NextSuggestion[] = [
      {
        id: 'orders.set_status',
        label: 'עדכן סטטוס להזמנה מהמפה',
        paramsHint: { orderId: pins[0]?.id, newStatus: 'READY_FOR_INSTALL' },
      },
      DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reports.status_dashboard')!,
    ].filter(Boolean) as NextSuggestion[];

    return {
      title: 'מפת הזמנות לפי סטטוס',
      view: 'map',
      blocks: [
        {
          type: 'mapPins',
          pins,
          filters: normalizedStatuses ? { status: normalizedStatuses } : undefined,
        },
      ],
      nextSuggestions: suggestions,
      statePatch: {
        lastActionId: 'map.orders_by_status',
        lastFilters: {
          status: normalizedStatuses,
        },
        selectedOrderIds: pins.slice(0, 5).map((p) => p.id),
      },
    };
  },
};

export const mapActions: Record<string, ActionDefinition<any>> = {
  [mapOrdersByStatusAction.id]: mapOrdersByStatusAction,
};
