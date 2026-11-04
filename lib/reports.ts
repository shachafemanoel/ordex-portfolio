import { prisma } from '@/lib/db';
import { normalizeOrderStatus } from '@/lib/orderStatus';

export async function statusCounts() {
  const groups = await prisma.order.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  const aggregated = groups.reduce<Record<string, number>>((acc, g: any) => {
    const normalized = normalizeOrderStatus(g.status);
    acc[normalized] = (acc[normalized] ?? 0) + (g._count.id ?? 0);
    return acc;
  }, {});
  return Object.entries(aggregated).map(([status, count]) => ({ status, count }));
}

export async function purchaseReport() {
  return prisma.orderItem.findMany({
    where: { order: { status: 'PO_CREATED' } },
    include: { product: { include: { defaultSupplier: true } }, order: true },
  });
}

export async function waitingStock() {
  return prisma.order.findMany({ where: { status: 'AWAITING_STOCK' } });
}

export interface WaitingInstallFilters {
  userId?: string;
}

export async function waitingInstall(filters: WaitingInstallFilters = {}) {
  const where: Record<string, unknown> = {
    status: { in: ['READY_FOR_INSTALL', 'SCHEDULED', 'INSTALL_SCHEDULING', 'AWAITING_INSTALL'] },
  };

  if (filters.userId) {
    where.assignedUserId = filters.userId;
  }

  return prisma.order.findMany({
    where,
    orderBy: { scheduledAt: 'asc' },
  });
}

export async function history(month: number, year: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);
  return prisma.order.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: 'desc' },
  });
}
