import { FulfillmentType, OrderStatus, Prisma, ScheduleMode } from '@prisma/client';
import { prisma } from '@/lib/db';

export const DEFAULT_INSTALLATION_STATUSES: OrderStatus[] = [
  OrderStatus.READY_FOR_INSTALL,
  OrderStatus.SCHEDULED,
  OrderStatus.INSTALL_SCHEDULING,
  OrderStatus.AWAITING_INSTALL,
];

export function parseInstallationStatuses(rawValues: Array<string | OrderStatus>): OrderStatus[] {
  const normalized = rawValues
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const validStatuses = new Set<string>(Object.values(OrderStatus));
  // Use Set to deduplicate
  const uniqueStatuses = Array.from(
    new Set(normalized.filter((status) => validStatuses.has(status)))
  );

  return uniqueStatuses.length ? (uniqueStatuses as OrderStatus[]) : DEFAULT_INSTALLATION_STATUSES;
}

export interface InstallationOrderItem {
  id: string;
  name: string;
  qty: number;
  receivedQuantity: number;
}

export interface InstallationOrderSummary {
  id: string;
  number: string;
  status: OrderStatus;
  city: string | null;
  addressLine: string | null;
  lat: number | null;
  lng: number | null;
  scheduledAt: string | null;
  scheduledEnd: string | null;
  fulfillmentType: FulfillmentType;
  scheduleMode: ScheduleMode;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  notesToCrew: string | null;
  durationOverrideMinutes: number | null;
  installEventId: string | null;
  installerName: string | null;
  installerNotes: string | null;
  customer: {
    name: string;
    phone: string | null;
  };
  totals: {
    totalItems: number;
    receivedItems: number;
    pendingItems: number;
  };
  isReadyForScheduling: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: InstallationOrderItem[];
}

export interface InstallationFilters {
  statuses: OrderStatus[];
  city?: string;
  dateFrom?: Date;
  dateTo?: Date;
  skip?: number;
  take?: number;
}

const DEFAULT_TAKE = 100;

function buildWhereClause(filters: InstallationFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    status: { in: filters.statuses },
  };

  if (filters.city) {
    where.city = { equals: filters.city, mode: 'insensitive' };
  }

  if (filters.dateFrom || filters.dateTo) {
    const scheduledAt: Prisma.DateTimeNullableFilter = {};
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      scheduledAt.gte = from;
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      scheduledAt.lte = to;
    }
    where.scheduledAt = scheduledAt;
  }

  return where;
}

function mapOrder(order: {
  id: string;
  number: string;
  status: OrderStatus;
  city: string | null;
  addressLine: string | null;
  lat: number | null;
  lng: number | null;
  latitude: number | null;
  longitude: number | null;
  scheduledAt: Date | null;
  scheduledEnd: Date | null;
  fulfillmentType: FulfillmentType;
  scheduleMode: ScheduleMode;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  notesToCrew: string | null;
  durationOverrideMinutes: number | null;
  installEventId: string | null;
  notesInternal: string | null;
  installerName: string | null;
  installerNotes: string | null;
  demo: boolean;
  createdAt: Date;
  updatedAt: Date;
  customer: { name: string | null; phone: string | null } | null;
  items: { id: string; name: string; qty: number; receivedQuantity: number }[];
}): InstallationOrderSummary {
  const totals = order.items.reduce(
    (acc, item) => {
      acc.totalItems += item.qty;
      acc.receivedItems += item.receivedQuantity;
      return acc;
    },
    { totalItems: 0, receivedItems: 0 }
  );

  const pendingItems = Math.max(totals.totalItems - totals.receivedItems, 0);

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    city: order.city,
    addressLine: order.addressLine,
    lat: order.lat ?? order.latitude ?? null,
    lng: order.lng ?? order.longitude ?? null,
    scheduledAt: order.scheduledAt?.toISOString() ?? null,
    scheduledEnd: order.scheduledEnd?.toISOString() ?? null,
    fulfillmentType: order.fulfillmentType,
    scheduleMode: order.scheduleMode,
    timeWindowStart: order.timeWindowStart,
    timeWindowEnd: order.timeWindowEnd,
    notesToCrew: order.notesToCrew,
    durationOverrideMinutes: order.durationOverrideMinutes,
    installEventId: order.installEventId ?? null,
    installerName: order.installerName,
    installerNotes: order.installerNotes,
    customer: {
      name: order.customer?.name ?? 'לקוח ללא שם',
      phone: order.customer?.phone ?? null,
    },
    totals: {
      totalItems: totals.totalItems,
      receivedItems: totals.receivedItems,
      pendingItems,
    },
    isReadyForScheduling: order.status === OrderStatus.AWAITING_INSTALL || pendingItems === 0,
    note: order.installerNotes ?? order.notesInternal,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      receivedQuantity: item.receivedQuantity,
    })),
  };
}

export async function fetchInstallationOrders(filters: InstallationFilters): Promise<{
  orders: InstallationOrderSummary[];
  total: number;
  availableCities: string[];
}> {
  const paginationTake = filters.take ?? DEFAULT_TAKE;
  const paginationSkip = filters.skip ?? 0;

  const where = buildWhereClause(filters);

  const [orders, total, cityRows] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
        items: {
          select: {
            id: true,
            name: true,
            qty: true,
            receivedQuantity: true,
          },
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      skip: paginationSkip,
      take: paginationTake,
    }),
    prisma.order.count({ where }),
    prisma.order.findMany({
      where: {
        status: { in: DEFAULT_INSTALLATION_STATUSES },
        city: { not: null },
      },
      select: { city: true },
    }),
  ]);

  const availableCities = Array.from(
    new Set(
      cityRows.map((row) => row.city?.trim()).filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));

  return {
    orders: orders.map(mapOrder),
    total,
    availableCities,
  };
}
