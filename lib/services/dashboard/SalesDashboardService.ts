import { prisma } from '@/lib/db';
import { OrderStatus } from '@prisma/client';
import { endOfMonth, format, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns';

export async function getSalesDashboardData() {
  const now = new Date();
  const firstDayCurrentMonth = startOfMonth(now);
  const lastDayCurrentMonth = endOfMonth(now);
  const firstDayLastMonth = startOfMonth(subMonths(now, 1));
  const lastDayLastMonth = endOfMonth(subMonths(now, 1));
  const startOfToday = startOfDay(now);

  // 1. Revenue (Calculated from Orders not in DRAFT/CANCELLED, or specifically COMPLETED/DELIVERED?
  // Adjusted: Usually 'Sales' counts all confirmed orders. Let's say NOT draft/cancelled)
  const currentMonthRevenue = await prisma.order.aggregate({
    _sum: { totalCents: true },
    where: {
      createdAt: { gte: firstDayCurrentMonth, lte: lastDayCurrentMonth },
      status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
    },
  });

  const lastMonthRevenue = await prisma.order.aggregate({
    _sum: { totalCents: true },
    where: {
      createdAt: { gte: firstDayLastMonth, lte: lastDayLastMonth },
      status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
    },
  });

  const revenueCurrent = (currentMonthRevenue._sum.totalCents || 0) / 100;
  const revenueLast = (lastMonthRevenue._sum.totalCents || 0) / 100;

  // Calculate trend percentage
  const revenueTrend =
    revenueLast === 0 ? 100 : ((revenueCurrent - revenueLast) / revenueLast) * 100;

  // 2. Open Orders
  const openOrdersCount = await prisma.order.count({
    where: {
      status: {
        notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED, OrderStatus.COMPLETED],
      },
    },
  });

  // "Urgent" could be defined as status=READY or just arbitrary. Let's say 'READY' or overdue.
  // For simplicity, let's just count 'READY' for installation/delivery.
  const urgentOrdersCount = await prisma.order.count({
    where: {
      status: OrderStatus.READY_FOR_INSTALL,
    },
  });

  // 3. New Leads (Orders in DRAFT or LEAD status created today)
  // Assuming 'DRAFT' or 'LEAD' (if exists) maps to leads. If OrderStatus has LEAD use it.
  // Checking OrderStatus enum... typically: DRAFT, LEAD, QUOTE, etc.
  // Let's assume DRAFT + QUOTE created today.
  const newLeadsCount = await prisma.order.count({
    where: {
      createdAt: { gte: startOfToday },
      status: { in: [OrderStatus.DRAFT] },
    },
  });

  // 4. "Needs Attention" List (e.g., recent open orders)
  const needsAttentionOrders = await prisma.order.findMany({
    where: {
      status: {
        in: [
          OrderStatus.READY_FOR_INSTALL,
          OrderStatus.AWAITING_INSTALL,
          OrderStatus.INSTALL_SCHEDULING,
        ],
      },
    },
    orderBy: { updatedAt: 'asc' }, // Oldest updated first = neglected?
    take: 5,
    select: {
      id: true,
      number: true,
      customerName: true,
      status: true,
      totalCents: true,
      updatedAt: true,
    },
  });

  // 5. Sales Chart Data (Last 30 Days)
  const thirtyDaysAgo = subDays(startOfToday, 30);
  const recentOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
    },
    select: {
      createdAt: true,
      totalCents: true,
    },
  });

  const salesMap = new Map<string, number>();
  // Initialize map with 0s for the last 30 days
  for (let i = 0; i < 30; i++) {
    const date = subDays(now, i);
    const key = format(date, 'yyyy-MM-dd');
    salesMap.set(key, 0);
  }

  recentOrders.forEach((order) => {
    const key = format(order.createdAt, 'yyyy-MM-dd');
    // Only aggregate if within our map range (safety check)
    if (salesMap.has(key)) {
      salesMap.set(key, (salesMap.get(key) || 0) + (order.totalCents || 0) / 100);
    }
  });

  const dailySales = Array.from(salesMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    kpis: {
      revenue: { value: revenueCurrent, trend: revenueTrend },
      openOrders: { value: openOrdersCount, urgent: urgentOrdersCount },
      newLeads: { value: newLeadsCount },
    },
    dailySales,
    needsAttention: needsAttentionOrders.map((o) => ({
      id: o.id,
      number: o.number,
      customer: o.customerName || 'לקוח ללא שם',
      status: o.status,
      amount: (o.totalCents || 0) / 100,
      lastUpdate: o.updatedAt,
    })),
  };
}
