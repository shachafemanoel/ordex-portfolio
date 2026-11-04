import type { OrderStatus } from '@prisma/client';
import { subDays, startOfDay, startOfWeek } from 'date-fns';
import { he } from 'date-fns/locale';
import { prisma } from '@/lib/db';
import { isDemo } from '@/lib/featureFlags';
import { ORDER_STATUS_FLOW, normalizeOrderStatus } from '@/lib/orderStatus';

export interface DashboardSnapshot {
  kpis: {
    ordersToday: number;
    ordersThisWeek: number;
    revenue30DaysCents: number;
    pendingApproval: number;
  };
  statusCounts: Record<OrderStatus, number>;
  timeline: Array<{
    date: string;
    ordersCount: number;
    totalCents: number;
  }>;
  recentOrders: Array<{
    id: string;
    number: string;
    customerName: string;
    totalCents: number;
    status: string;
    createdAt: string;
  }>;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 0, locale: he });
  const monthStart = subDays(today, 29);

  const whereBase = isDemo() ? { demo: true } : {};

  const [ordersToday, ordersThisWeek, revenue30Days, pendingApproval, statusCountsRaw, ordersForTimeline, recentOrders] = await Promise.all([
    prisma.order.count({ where: { ...whereBase, createdAt: { gte: today } } }),
    prisma.order.count({ where: { ...whereBase, createdAt: { gte: weekStart } } }),
    prisma.order.aggregate({
      where: { ...whereBase, createdAt: { gte: monthStart } },
      _sum: { totalCents: true },
    }),
    prisma.order.count({ where: { ...whereBase, status: 'DRAFT' } }),
    // Get counts for all statuses
    prisma.order.groupBy({
      by: ['status'],
      where: whereBase,
      _count: { status: true },
    }),
    prisma.order.findMany({
      where: { ...whereBase, createdAt: { gte: monthStart } },
      select: { id: true, createdAt: true, totalCents: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.order.findMany({
      where: whereBase,
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        customer: { select: { name: true } },
      },
    }),
  ]);

  // Convert status counts to structured object
  const statusCounts = ORDER_STATUS_FLOW.reduce<Record<OrderStatus, number>>((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<OrderStatus, number>);

  statusCountsRaw.forEach(({ status, _count }) => {
    const canonical = normalizeOrderStatus(status);
    if (canonical in statusCounts) {
      statusCounts[canonical as keyof typeof statusCounts] = _count.status;
    }
  });

  const buckets = new Map<string, { ordersCount: number; totalCents: number }>();
  ordersForTimeline.forEach((order) => {
    const key = order.createdAt.toISOString().split('T')[0];
    if (!buckets.has(key)) {
      buckets.set(key, { ordersCount: 0, totalCents: 0 });
    }
    const bucket = buckets.get(key)!;
    bucket.ordersCount += 1;
    bucket.totalCents += order.totalCents;
  });

  const timeline: DashboardSnapshot['timeline'] = [];
  for (let day = 0; day < 30; day++) {
    const date = subDays(today, 29 - day);
    const key = date.toISOString().split('T')[0];
    const bucket = buckets.get(key);
    timeline.push({
      date: key,
      ordersCount: bucket?.ordersCount ?? 0,
      totalCents: bucket?.totalCents ?? 0,
    });
  }

  return {
    kpis: {
      ordersToday,
      ordersThisWeek,
      revenue30DaysCents: revenue30Days._sum.totalCents ?? 0,
      pendingApproval,
    },
    statusCounts,
    timeline,
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      number: order.number,
      customerName: order.customer?.name ?? 'לקוח ללא שם',
      totalCents: order.totalCents,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}
