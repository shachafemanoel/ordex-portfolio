/**
 * Ops Queues Service
 *
 * Computes queue-based views for the daily operational boards.
 * Uses persisted order fields (taskLabel, opsLane, status, urgent, etc.)
 * to build grouped queues without per-order DrillState recomputation.
 */

import { haversineKm } from '@/lib/geo/haversineKm';
import { prisma } from '@/lib/db';
import { OrderStatus, Prisma } from '@prisma/client';
import type {
  OpsScope,
  OpsTab,
  OpsQueue,
  OpsQueueItem,
  OpsQueuesResponse,
} from '../dto/ops.dto';
import { deriveOrderTask } from '@/src/server/services/ops-triggers.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAILY_WINDOW_HOURS = 12;
const REST_CAP = 20;
const INTAKE_DAILY_WINDOW_STATUSES: OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.DRAFT,
  OrderStatus.TO_DO,
  OrderStatus.CALL_BACK,
];

/** Statuses that are terminal — excluded from all queues */
const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.CLOSED,
  OrderStatus.REFUNDED,
];

// ---------------------------------------------------------------------------
// Queue key definitions & mappings
// ---------------------------------------------------------------------------

/** Maps TaskLabel values to Orders Ops queue keys */
const TASK_TO_ORDERS_QUEUE: Record<string, string> = {
  VERIFY_PAYMENT: 'PREP',
  VERIFY_ORDER: 'PREP',
  VERIFY_STOCK: 'PREP',
  CREATE_PURCHASE_ORDER: 'NEED_PO',
  ASSIGN_SUPPLIERS: 'NEED_PO',
  WAIT_SUPPLIER_DELIVERY: 'NEED_RECEIPT',
  RECEIVE_GOODS: 'NEED_RECEIPT',
  RECEIVE_GOODS_PARTIAL: 'NEED_RECEIPT',
  CALLBACK_CUSTOMER: 'NEED_CUSTOMER',
  SCHEDULE_INSTALLATION: 'NEED_DELIVERY_SCHED',
  WAIT_INSTALLATION_DAY: 'NEED_DELIVERY_SCHED',
  CLOSE_ORDER: 'PREP',
};

/** Human-readable titles for Orders Ops queue keys */
const ORDERS_QUEUE_TITLES: Record<string, string> = {
  PREP: 'הכנה ותשלום',
  NEED_PO: 'הזמנת רכש',
  NEED_RECEIPT: 'קליטת סחורה',
  NEED_CUSTOMER: 'חזרה ללקוח',
  NEED_DELIVERY_SCHED: 'תיאום אספקה',
};

/** Maps OrderStatus values to Shipments Ops queue keys */
const STATUS_TO_SHIPMENTS_QUEUE: Record<string, string> = {
  READY_FOR_INSTALL: 'TO_PICK',
  INSTALL_SCHEDULING: 'TO_PICK',
  AWAITING_INSTALL: 'TO_PICK',
  SCHEDULED: 'TO_PICK',
  SUPPLIED: 'TO_PICK',
  READY: 'TO_PICK',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  INSTALLATION: 'OUT_FOR_DELIVERY',
  ON_HOLD: 'FAILED_DELIVERY',
};

/** Human-readable titles for Shipments Ops queue keys */
const SHIPMENTS_QUEUE_TITLES: Record<string, string> = {
  TO_PICK: 'ליקוט',
  OUT_FOR_DELIVERY: 'במשלוח',
  FAILED_DELIVERY: 'משלוח נכשל',
};

/** Desired display order for queue keys */
const ORDERS_QUEUE_ORDER = ['PREP', 'NEED_PO', 'NEED_RECEIPT', 'NEED_CUSTOMER', 'NEED_DELIVERY_SCHED'];
const SHIPMENTS_QUEUE_ORDER = ['TO_PICK', 'OUT_FOR_DELIVERY', 'FAILED_DELIVERY'];

async function loadDefaultWarehouseRef(): Promise<{ lat: number; lng: number } | null> {
  const row = await prisma.storeConfiguration.findUnique({
    where: { id: 'default' },
    select: { warehouseLat: true, warehouseLng: true },
  });
  const lat = row?.warehouseLat;
  const lng = row?.warehouseLng;
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return { lat, lng };
}

function pickOrderCoordinates(order: OrderRow): { lat: number; lng: number } | null {
  const candidates: Array<[number | null | undefined, number | null | undefined]> = [
    [order.lat, order.lng],
    [order.latitude, order.longitude],
  ];
  for (const [la, ln] of candidates) {
    if (
      typeof la === 'number' &&
      typeof ln === 'number' &&
      Number.isFinite(la) &&
      Number.isFinite(ln)
    ) {
      return { lat: la, lng: ln };
    }
  }
  return null;
}

function distanceFromWarehouseKm(
  order: OrderRow,
  warehouse: { lat: number; lng: number } | null
): number | null {
  if (!warehouse) return null;
  const pt = pickOrderCoordinates(order);
  if (!pt) return null;
  return Math.round(haversineKm(warehouse, pt) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getOpsQueues(
  scope: OpsScope,
  tab: OpsTab,
): Promise<OpsQueuesResponse> {
  if (scope === 'orders') {
    return getOrdersOpsQueues(tab);
  }
  return getShipmentsOpsQueues();
}

/**
 * Fetches the most recently updated active orders for the dashboard,
 * formatted as OpsQueueItems so they render perfectly in OrderCard.
 */
export async function getRecentOpsCards(limit = 10): Promise<OpsQueueItem[]> {
  const warehouseRef = await loadDefaultWarehouseRef();
  const orders = await prisma.order.findMany({
    where: {
      status: { notIn: TERMINAL_STATUSES },
      deletedAt: null,
    },
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      city: true,
      addressLine: true,
      lat: true,
      lng: true,
      latitude: true,
      longitude: true,
      scheduledAt: true,
      opsSnoozeUntil: true,
      urgent: true,
      createdAt: true,
      taskLabel: true,
      opsCurrentTask: true,
      opsLane: true,
      status: true,
      number: true,
      onHold: true,
      items: {
        select: {
          allocationStatus: true,
          received: true,
          name: true,
          qty: true,
        },
      },
      fulfillmentType: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return orders.map((o) => toQueueItem(o as unknown as OrderRow, warehouseRef));
}

// ---------------------------------------------------------------------------
// Orders Ops
// ---------------------------------------------------------------------------

async function getOrdersOpsQueues(tab: OpsTab): Promise<OpsQueuesResponse> {
  const warehouseRef = await loadDefaultWarehouseRef();
  const now = new Date();
  const windowEdge = new Date(now.getTime() + DAILY_WINDOW_HOURS * 60 * 60 * 1000);

  // Build the daily-window / future WHERE clause
  const dailyWindowCondition = buildDailyWindowCondition(now, windowEdge);

  const whereBase: Prisma.OrderWhereInput = {
    status: { notIn: TERMINAL_STATUSES },
    deletedAt: null,
  };

  // 'active' = all non-terminal orders (no time-window filter)
  const where: Prisma.OrderWhereInput =
    tab === 'active'
      ? whereBase
      : tab === 'new'
        ? { ...whereBase, ...dailyWindowCondition }
        : { ...whereBase, NOT: dailyWindowCondition };

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      city: true,
      addressLine: true,
      lat: true,
      lng: true,
      latitude: true,
      longitude: true,
      scheduledAt: true,
      opsSnoozeUntil: true,
      urgent: true,
      createdAt: true,
      taskLabel: true,
      opsCurrentTask: true,
      opsLane: true,
      status: true,
      number: true,
      onHold: true,
      items: {
        select: {
          allocationStatus: true,
          received: true,
          name: true,
          qty: true,
        }
      },
      fulfillmentType: true,
    },
    orderBy: [
      { urgent: 'desc' },
      { scheduledAt: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  // Group into queues by taskLabel mapping
  const buckets = new Map<string, typeof orders>();

  for (const order of orders) {
    const taskKey = order.taskLabel ?? order.opsCurrentTask ?? '';
    const queueKey = TASK_TO_ORDERS_QUEUE[taskKey] ?? 'PREP';
    if (!buckets.has(queueKey)) buckets.set(queueKey, []);
    buckets.get(queueKey)!.push(order);
  }

  // Build queue objects in display order
  const queues: OpsQueue[] = [];

  for (const key of ORDERS_QUEUE_ORDER) {
    const items = buckets.get(key);
    if (!items || items.length === 0) continue;

    queues.push(buildQueue(key, ORDERS_QUEUE_TITLES[key] ?? key, items, warehouseRef));
  }

  // Include any unmapped queue keys that have items
  for (const [key, items] of buckets) {
    if (!ORDERS_QUEUE_ORDER.includes(key) && items.length > 0) {
      queues.push(buildQueue(key, ORDERS_QUEUE_TITLES[key] ?? key, items, warehouseRef));
    }
  }

  return {
    scope: 'orders',
    tab,
    dailyWindowHours: DAILY_WINDOW_HOURS,
    queues,
  };
}

// ---------------------------------------------------------------------------
// Shipments Ops
// ---------------------------------------------------------------------------

async function getShipmentsOpsQueues(): Promise<OpsQueuesResponse> {
  const warehouseRef = await loadDefaultWarehouseRef();
  const shipmentStatuses = Object.keys(STATUS_TO_SHIPMENTS_QUEUE) as OrderStatus[];

  const orders = await prisma.order.findMany({
    where: {
      status: { in: shipmentStatuses },
      deletedAt: null,
    },
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      city: true,
      addressLine: true,
      lat: true,
      lng: true,
      latitude: true,
      longitude: true,
      scheduledAt: true,
      opsSnoozeUntil: true,
      urgent: true,
      createdAt: true,
      taskLabel: true,
      opsCurrentTask: true,
      opsLane: true,
      status: true,
      number: true,
      onHold: true,
      items: {
        select: {
          allocationStatus: true,
          received: true,
          name: true,
          qty: true,
        }
      },
      fulfillmentType: true,
    },
    orderBy: [
      { urgent: 'desc' },
      { scheduledAt: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  const buckets = new Map<string, typeof orders>();

  for (const order of orders) {
    const queueKey = STATUS_TO_SHIPMENTS_QUEUE[order.status] ?? null;
    if (!queueKey) continue;
    if (!buckets.has(queueKey)) buckets.set(queueKey, []);
    buckets.get(queueKey)!.push(order);
  }

  const queues: OpsQueue[] = [];

  for (const key of SHIPMENTS_QUEUE_ORDER) {
    const items = buckets.get(key);
    if (!items || items.length === 0) continue;

    queues.push(buildQueue(key, SHIPMENTS_QUEUE_TITLES[key] ?? key, items, warehouseRef));
  }

  return {
    scope: 'shipments',
    tab: 'new',
    dailyWindowHours: DAILY_WINDOW_HOURS,
    queues,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the Prisma WHERE condition that defines the daily window.
 *
 * An order is in the daily window if ANY of:
 * - opsLane = 'NEEDS_ACTION' (needs attention now)
 * - status is an intake status that requires manual triage now
 * - urgent = true
 * - opsSnoozeUntil is set and <= windowEdge (snooze expires within window)
 * - scheduledAt is set and <= windowEdge (scheduled within window)
 */
function buildDailyWindowCondition(
  _now: Date,
  windowEdge: Date,
): Prisma.OrderWhereInput {
  return {
    OR: [
      { opsLane: 'NEEDS_ACTION' },
      { status: { in: INTAKE_DAILY_WINDOW_STATUSES } },
      { urgent: true },
      {
        opsSnoozeUntil: { not: null, lte: windowEdge },
      },
      {
        scheduledAt: { not: null, lte: windowEdge },
      },
    ],
  };
}

interface OrderRowItem {
  name?: string | null;
  qty?: number | null;
  allocationStatus?: string | null;
  received?: boolean | null;
}

interface OrderRow {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  city: string | null;
  addressLine: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Reserved for future queue enrichment (e.g. route planning) */
  distanceKm?: number | null;
  scheduledAt: Date | null;
  opsSnoozeUntil: Date | null;
  urgent: boolean;
  createdAt: Date;
  number: string;
  status: string;
  onHold: boolean | null;
  items?: OrderRowItem[];
  fulfillmentType?: string | null;
}

function buildItemsMeta(
  items: OrderRowItem[]
): { summary: string | null; count: number; labels: string[] } {
  if (!items.length) return { summary: null, count: 0, labels: [] };
  const labels = items
    .map((item) => {
      const baseLabel = item.name?.trim();
      if (!baseLabel) return null;

      const quantity =
        typeof item.qty === 'number' && Number.isFinite(item.qty) && item.qty > 0 ? item.qty : null;
      return `${baseLabel}${quantity ? ` ×${quantity}` : ''}`;
    })
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (!labels.length) return { summary: null, count: items.length, labels: [] };
  const visible = labels.slice(0, 2);
  const remaining = labels.length - visible.length;
  return {
    summary: `${visible.join(' • ')}${remaining > 0 ? ` +${remaining}` : ''}`,
    count: items.length,
    labels,
  };
}

function toQueueItem(
  order: OrderRow,
  warehouseRef: { lat: number; lng: number } | null = null
): OpsQueueItem {
  // nextActionAt: prefer scheduledAt, then opsSnoozeUntil, then null
  const nextActionAt = order.scheduledAt ?? order.opsSnoozeUntil ?? null;
  const { summary: itemsSummary, count: itemsCount, labels: itemLabels } = buildItemsMeta(
    order.items ?? []
  );
  const computedDistance = distanceFromWarehouseKm(order, warehouseRef);

  return {
    id: order.id,
    number: order.number,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    city: order.city,
    addressLine: order.addressLine,
    distanceKm: order.distanceKm ?? computedDistance,
    nextActionAt: nextActionAt?.toISOString() ?? null,
    isUrgent: order.urgent,
    summary: `#${order.number}`,
    status: (order as any).status ?? null,
    derivedTask: deriveOrderTask(order as any),
    itemsSummary,
    itemsCount,
    itemLabels,
  };
}

function buildQueue(
  key: string,
  title: string,
  items: OrderRow[],
  warehouseRef: { lat: number; lng: number } | null
): OpsQueue {
  const count = items.length;
  const top = count > 0 ? toQueueItem(items[0], warehouseRef) : null;

  // rest = items[1..] capped at REST_CAP; omit if queue is huge (count > REST_CAP + 1)
  let rest: OpsQueueItem[] = [];
  if (count > 1 && count <= REST_CAP + 1) {
    rest = items.slice(1).map((row) => toQueueItem(row, warehouseRef));
  } else if (count > REST_CAP + 1) {
    rest = items.slice(1, REST_CAP + 1).map((row) => toQueueItem(row, warehouseRef));
  }

  return { key, title, top, count, rest };
}
