import { getPrismaClient } from '@/lib/db';
import { getStatusLabel, isPendingStatus, normalizeOrderStatus } from '@/lib/orderStatus';
import {
  OrderFilters,
  OrderVisibilityOptions,
  buildOrderWhereClause,
} from '@/lib/repositories/orders/OrdersRepository';
import { OrderStatus, Prisma } from '@prisma/client';

export type StatusAggregation = Record<OrderStatus, number>;

interface StatusMetricsResult {
  where: Prisma.OrderWhereInput;
  statusCounts: Array<{ status: OrderStatus; label: string; count: number }>;
  aggregatedCounts: StatusAggregation;
  totalOrders: number;
  pendingOrders: number;
}

export async function getOrderStatusMetrics(
  filters: OrderFilters = {},
  visibility?: OrderVisibilityOptions
): Promise<StatusMetricsResult> {
  const prisma = getPrismaClient();
  const where = buildOrderWhereClause(filters, visibility);

  const statusCountsRaw = await prisma.order.groupBy({
    by: ['status'],
    _count: { id: true },
    where,
  });

  const aggregatedCounts = statusCountsRaw.reduce<StatusAggregation>((acc, item) => {
    const normalized = normalizeOrderStatus(item.status as OrderStatus);
    acc[normalized] = (acc[normalized] ?? 0) + item._count.id;
    return acc;
  }, {} as StatusAggregation);

  const statusCounts = Object.entries(aggregatedCounts).map(([status, count]) => ({
    status: status as OrderStatus,
    label: getStatusLabel(status as OrderStatus),
    count,
  }));

  const totalOrders = statusCounts.reduce((sum, entry) => sum + entry.count, 0);
  const pendingOrders = statusCounts
    .filter((entry) => isPendingStatus(entry.status))
    .reduce((sum, entry) => sum + entry.count, 0);

  return { where, statusCounts, aggregatedCounts, totalOrders, pendingOrders };
}

export function getCompletedCount(counts: StatusAggregation): number {
  return counts[normalizeOrderStatus('SUPPLIED')] ?? 0;
}

export function getInstallationsPendingCount(counts: StatusAggregation): number {
  const scheduling = counts[normalizeOrderStatus('INSTALL_SCHEDULING')] ?? 0;
  const awaiting = counts[normalizeOrderStatus('AWAITING_INSTALL')] ?? 0;
  return scheduling + awaiting;
}
