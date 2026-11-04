import { prisma } from '@/lib/db';
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, normalizeOrderStatus } from '@/lib/orderStatus';
import type { OrderStatus, Prisma } from '@prisma/client';

export interface StatusReportQuery {
  statuses?: string[] | OrderStatus[];
  dateFrom?: string;
  dateTo?: string;
  city?: string;
  includeEmpty?: boolean;
  limit?: number;
  offset?: number;
}

export interface StatusReportRow {
  status: OrderStatus;
  label: string;
  count: number;
  totalValue: number;
  percentage: number;
  oldestOrder?: string | null;
  newestOrder?: string | null;
  avgOrderAgeDays?: number;
  recentOrders: Array<{
    id: string;
    number: string;
    createdAt: string;
    totalValue: number;
    city?: string | null;
  }>;
}

export interface StatusReportSummary {
  totalOrders: number;
  totalValue: number;
  statuses: number;
  period?: {
    from?: string;
    to?: string;
  };
}

export interface StatusReportPayload {
  generatedAt: string;
  rows: StatusReportRow[];
  summary: StatusReportSummary;
  filters: {
    statuses?: OrderStatus[];
    city?: string;
    dateFrom?: string;
    dateTo?: string;
    includeEmpty: boolean;
  };
}

const RECENT_PREVIEW_LIMIT = 3;
const MAX_HIGHLIGHT_ORDERS = 100;

export async function buildStatusReport(query: StatusReportQuery): Promise<StatusReportPayload> {
  const normalizedStatuses = dedupeStatuses(query.statuses);
  const includeEmpty = Boolean(query.includeEmpty);
  const whereClause = buildWhereClause({ ...query, statuses: normalizedStatuses });

  const grouped = await prisma.order.groupBy({
    where: whereClause,
    by: ['status'],
    _count: { id: true },
    _sum: { totalCents: true },
    _min: { createdAt: true },
    _max: { createdAt: true },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
  });

  const totalOrders = grouped.reduce((sum, item) => sum + (item._count.id ?? 0), 0);
  const totalValue = grouped.reduce((sum, item) => sum + (item._sum.totalCents ?? 0), 0);

  const highlightOrders = await prisma.order.findMany({
    where: whereClause,
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      city: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: Math.min(query.limit ?? MAX_HIGHLIGHT_ORDERS, MAX_HIGHLIGHT_ORDERS),
  });

  const recentPreviews = mapRecentOrders(highlightOrders);
  const statusSequence = resolveStatusesToEmit({ includeEmpty, normalizedStatuses, grouped });
  const rows = statusSequence.map((status) =>
    buildRow({
      status,
      group: grouped.find((item) => item.status === status),
      totalOrders,
      recentOrders: recentPreviews.get(status) ?? [],
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    rows,
    summary: {
      totalOrders,
      totalValue,
      statuses: rows.length,
      period: {
        from: query.dateFrom,
        to: query.dateTo,
      },
    },
    filters: {
      statuses: normalizedStatuses,
      city: query.city,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      includeEmpty,
    },
  };
}

function dedupeStatuses(statuses?: string[] | OrderStatus[]): OrderStatus[] | undefined {
  if (!statuses || statuses.length === 0) {
    return undefined;
  }

  const normalized = statuses.map((status) => normalizeOrderStatus(status));
  return Array.from(new Set(normalized));
}

function buildWhereClause(
  filters: StatusReportQuery & { statuses?: OrderStatus[] }
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (filters.statuses?.length) {
    where.status = { in: filters.statuses };
  }

  if (filters.city) {
    where.city = {
      contains: filters.city,
      mode: 'insensitive',
    };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      where.createdAt.gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      where.createdAt.lte = new Date(filters.dateTo);
    }
  }

  return where;
}

function mapRecentOrders(
  highlightOrders: Array<{
    id: string;
    number: string;
    status: OrderStatus;
    totalCents: number;
    city: string | null;
    createdAt: Date;
  }>
): Map<OrderStatus, StatusReportRow['recentOrders']> {
  const previews = new Map<OrderStatus, StatusReportRow['recentOrders']>();

  for (const order of highlightOrders) {
    const bucket = previews.get(order.status) ?? [];
    if (bucket.length >= RECENT_PREVIEW_LIMIT) {
      previews.set(order.status, bucket);
      continue;
    }

    bucket.push({
      id: order.id,
      number: order.number,
      createdAt: order.createdAt.toISOString(),
      totalValue: order.totalCents,
      city: order.city,
    });
    previews.set(order.status, bucket);
  }

  return previews;
}

function resolveStatusesToEmit({
  includeEmpty,
  normalizedStatuses,
  grouped,
}: {
  includeEmpty: boolean;
  normalizedStatuses?: OrderStatus[];
  grouped: Array<{ status: OrderStatus }>;
}): OrderStatus[] {
  if (includeEmpty) {
    if (normalizedStatuses?.length) {
      return normalizedStatuses;
    }
    return ORDER_STATUS_FLOW;
  }

  return grouped.length > 0 ? grouped.map((item) => item.status) : (normalizedStatuses ?? []);
}

function buildRow({
  status,
  group,
  totalOrders,
  recentOrders,
}: {
  status: OrderStatus;
  group?:
    | {
        _count: { id: number };
        _sum: { totalCents: number | null };
        _min: { createdAt: Date | null };
        _max: { createdAt: Date | null };
      }
    | undefined;
  totalOrders: number;
  recentOrders: StatusReportRow['recentOrders'];
}): StatusReportRow {
  const count = group?._count.id ?? 0;
  const totalValue = group?._sum.totalCents ?? 0;
  const newest = group?._max.createdAt?.toISOString() ?? null;
  const oldest = group?._min.createdAt?.toISOString() ?? null;
  const avgAge = computeAverageAgeDays(group?._max.createdAt, group?._min.createdAt);

  return {
    status,
    label: ORDER_STATUS_LABELS[status] ?? status,
    count,
    totalValue,
    percentage: totalOrders > 0 ? Number(((count / totalOrders) * 100).toFixed(2)) : 0,
    newestOrder: newest,
    oldestOrder: oldest,
    avgOrderAgeDays: avgAge,
    recentOrders,
  };
}

function computeAverageAgeDays(newest?: Date | null, oldest?: Date | null): number | undefined {
  if (!newest && !oldest) {
    return undefined;
  }

  const now = Date.now();
  const newestAge = newest ? now - newest.getTime() : 0;
  const oldestAge = oldest ? now - oldest.getTime() : newestAge;
  const averageMs = (newestAge + oldestAge) / 2;
  return Number((averageMs / (1000 * 60 * 60 * 24)).toFixed(1));
}
