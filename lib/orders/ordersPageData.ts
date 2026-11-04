import {
  getInitialLabelsForLegacyStatus,
  mapLegacyStatusToStage,
} from '@/components/orders/shared/orderStageMapping';
import { getOrdersService } from '@/lib/services/ServiceFactory';
import { OrderStatus } from '@prisma/client';

type OrdersService = ReturnType<typeof getOrdersService>;
type ListOrdersResult = Awaited<ReturnType<OrdersService['listOrders']>>;
type OrderListItem = ListOrdersResult['items'][number];

type HistoryEntry = {
  toStatus?: string;
  createdAt?: string | Date;
  reason?: string | null;
};

function toTotalAmount(order: OrderListItem): number {
  if (typeof order.total === 'number') return order.total;
  if (typeof order.totalCents === 'number') return order.totalCents / 100;
  return 0;
}

function toCustomerName(order: OrderListItem): string {
  return order.customerName || order.customer?.name || 'לקוח מזדמן';
}

function toStatusHistory(order: OrderListItem) {
  const statusHistory = (order as OrderListItem & { statusHistory?: HistoryEntry[] }).statusHistory;
  if (!Array.isArray(statusHistory)) return [];

  return statusHistory.map((entry) => ({
    title: `הועבר ל-${entry.toStatus ?? ''}`,
    time: new Date(entry.createdAt ?? Date.now()).toLocaleString('he-IL'),
    type: 'status' as const,
    note: entry.reason ?? undefined,
  }));
}

export type PipelineKanbanOrder = {
  id: string;
  number: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  address?: string | null;
  status: OrderStatus;
  stage: string;
  labels: Array<{ id: string; name: string; color: string; stage?: string | null } | string>;
  createdAt: string | Date;
  updatedAt: string | Date;
  priority: string;
  totalAmount: number;
  hasNotes: boolean;
  history: Array<{
    title: string;
    time: string;
    type: 'status';
    note?: string;
  }>;
};

export type DeliveryKanbanOrder = {
  id: string;
  number: string;
  customerName: string;
  itemsSummary: string;
  totalAmount: number;
  status: OrderStatus;
  updatedAt: string;
  city?: string | null;
  scheduledAt?: string | Date | null;
  lat?: number | null;
  lng?: number | null;
};

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function getPipelineKanbanOrders(limit = 150): Promise<PipelineKanbanOrder[]> {
  const service = getOrdersService();
  const result = await service.listOrders({}, { limit, sortBy: 'updatedAt:desc' });

  return result.items.map((order) => {
    const stage = mapLegacyStatusToStage(order.status);
    const initialLabels = getInitialLabelsForLegacyStatus(order.status);

    return {
      id: order.id,
      number: order.number,
      customerName: toCustomerName(order),
      customerPhone: order.customerPhone || order.customer?.phone,
      customerEmail: order.customerEmail || order.customer?.email,
      address: order.shippingAddress?.city || order.city,
      status: order.status,
      stage,
      labels: order.labels || initialLabels,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      priority: order.priority || 'MEDIUM',
      totalAmount: toTotalAmount(order),
      hasNotes: Boolean(
        order.notes || (order as OrderListItem & { notesInternal?: string }).notesInternal
      ),
      history: toStatusHistory(order),
    };
  });
}

export async function getDeliveryKanbanOrders(limit = 100): Promise<DeliveryKanbanOrder[]> {
  const service = getOrdersService();
  const result = await service.listOrders({}, { limit });

  return result.items.map((order) => ({
    id: order.id,
    number: order.number,
    customerName: order.customerName || 'לקוח מזדמן',
    itemsSummary:
      order.items?.map((item) => `${item.quantity}x ${item.name}`).join(', ') || 'אין פריטים',
    totalAmount: order.total || 0,
    status: order.status,
    updatedAt: toIsoString(order.updatedAt),
    city: order.shippingAddress?.city || order.city,
    scheduledAt: order.scheduledAt ? toIsoString(order.scheduledAt) : null,
    lat: order.lat ?? order.latitude ?? null,
    lng: order.lng ?? order.longitude ?? null,
  }));
}
