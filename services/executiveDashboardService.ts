import { prisma } from '@/lib/db';
import { ORDER_STATUS_FLOW, normalizeOrderStatus } from '@/lib/orderStatus';
import type { OrderStatus } from '@prisma/client';

type KpiStatus = 'good' | 'warning' | 'critical' | 'info';

export interface ExecutiveKpi {
  id: string;
  title: string;
  value: string;
  helper: string;
  changeLabel?: string;
  status: KpiStatus;
  sparkline?: number[];
}

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  href?: string;
}

export interface ExecutiveDashboardData {
  kpis: ExecutiveKpi[];
  alerts: AlertItem[];
}

// Revenue is recognized only on finalized orders
const FINALIZED_STATUSES: OrderStatus[] = ['COMPLETED', 'INVOICED'];
// Active pipeline excludes cancellations; use this for counts/receivables
const EXCLUDED_STATUSES: OrderStatus[] = ['CANCELLED'];

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getExecutiveDashboardData(): Promise<ExecutiveDashboardData> {
  const monthStart = startOfMonth();
  const prevMonthStart = startOfMonth(
    new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1)
  );
  const last90Days = startOfDay(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
  const last30Days = startOfDay(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

  const [revenueCurrentAgg, revenuePrevAgg, revenueDaily] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: FINALIZED_STATUSES }, createdAt: { gte: monthStart } },
      _sum: { totalCents: true },
    }),
    prisma.order.aggregate({
      where: {
        status: { in: FINALIZED_STATUSES },
        createdAt: { gte: prevMonthStart, lt: monthStart },
      },
      _sum: { totalCents: true },
    }),
    prisma.order.findMany({
      where: { status: { in: FINALIZED_STATUSES }, createdAt: { gte: last30Days } },
      select: { createdAt: true, totalCents: true, status: true },
    }),
  ]);

  const revenueCurrent = (revenueCurrentAgg._sum?.totalCents ?? 0) / 100;
  const revenuePrev = (revenuePrevAgg._sum?.totalCents ?? 0) / 100;
  const revenueChange =
    revenuePrev > 0 ? ((revenueCurrent - revenuePrev) / revenuePrev) * 100 : null;

  // DSO
  const [outstandingOrders, revenueLast30Agg] = await Promise.all([
    prisma.order.findMany({
      where: { status: { notIn: EXCLUDED_STATUSES }, paymentStatus: { not: 'PAID' } },
      select: { totalCents: true, paidAmountCents: true },
    }),
    prisma.order.aggregate({
      where: { status: { in: FINALIZED_STATUSES }, createdAt: { gte: last30Days } },
      _sum: { totalCents: true },
    }),
  ]);

  const outstandingCents = outstandingOrders.reduce((sum, order) => {
    const open = Math.max(0, order.totalCents - order.paidAmountCents);
    return sum + open;
  }, 0);
  const revenueLast30 = (revenueLast30Agg._sum?.totalCents ?? 0) / 100;
  const dsoDays =
    revenueLast30 > 0 ? Math.round((outstandingCents / 100 / revenueLast30) * 30 * 10) / 10 : null;

  // Cycle time and on-time delivery (90d window)
  const completedRecent = await prisma.order.findMany({
    where: {
      status: { in: FINALIZED_STATUSES },
      completedAt: { not: null },
      createdAt: { gte: last90Days },
    },
    select: {
      createdAt: true,
      completedAt: true,
      scheduledAt: true,
    },
  });

  const cycleDurations = completedRecent
    .filter((o) => o.completedAt)
    .map((o) =>
      Math.max(0, (o.completedAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    )
    .sort((a, b) => a - b);

  const cycleAverage =
    cycleDurations.length > 0
      ? Math.round((cycleDurations.reduce((sum, d) => sum + d, 0) / cycleDurations.length) * 10) /
        10
      : null;
  const cycleMedian =
    cycleDurations.length > 0
      ? (() => {
          const mid = Math.floor(cycleDurations.length / 2);
          if (cycleDurations.length % 2 === 0) {
            return Math.round(((cycleDurations[mid - 1] + cycleDurations[mid]) / 2) * 10) / 10;
          }
          return Math.round(cycleDurations[mid] * 10) / 10;
        })()
      : null;

  const onTimeSample = completedRecent.filter((o) => o.scheduledAt && o.completedAt);
  const onTimeCount = onTimeSample.filter((o) => o.completedAt! <= o.scheduledAt!).length;
  const onTimeRate =
    onTimeSample.length > 0 ? Math.round((onTimeCount / onTimeSample.length) * 1000) / 10 : null;

  // Build revenue sparkline over last 30 days
  const sparklineMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const day = new Date(last30Days);
    day.setDate(day.getDate() + i);
    sparklineMap.set(day.toISOString().slice(0, 10), 0);
  }
  revenueDaily
    .filter((row) => ORDER_STATUS_FLOW.includes(normalizeOrderStatus(row.status)))
    .forEach((row) => {
      const key = startOfDay(row.createdAt).toISOString().slice(0, 10);
      sparklineMap.set(key, (sparklineMap.get(key) ?? 0) + (row.totalCents ?? 0) / 100);
    });
  const revenueSparkline = Array.from(sparklineMap.values());

  const kpis: ExecutiveKpi[] = [
    {
      id: 'revenue',
      title: 'Revenue This Month',
      value: `₪${revenueCurrent.toLocaleString('he-IL')}`,
      helper: 'Finalized orders (הושלם/חשבונית) this month',
      changeLabel:
        revenueChange !== null
          ? `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}% vs last month`
          : 'No prior data',
      status: revenueChange !== null && revenueChange < 0 ? 'warning' : 'good',
      sparkline: revenueSparkline,
    },
    {
      id: 'gross-margin',
      title: 'Gross Margin %',
      value: '—',
      helper: 'COGS not tracked yet',
      status: 'info',
      sparkline: undefined,
    },
    {
      id: 'on-time',
      title: 'On-Time Delivery %',
      value: onTimeRate !== null ? `${onTimeRate}%` : '—',
      helper:
        onTimeSample.length > 0
          ? `${onTimeSample.length - onTimeCount} late of ${onTimeSample.length}`
          : 'No scheduled deliveries',
      status: onTimeRate !== null && onTimeRate < 95 ? 'warning' : 'good',
    },
    {
      id: 'churn',
      title: 'Customer Churn % (90d)',
      value: '—',
      helper: 'Retention tracking not wired',
      status: 'info',
    },
    {
      id: 'dso',
      title: 'DSO (days)',
      value: dsoDays !== null ? dsoDays.toLocaleString('he-IL') : '—',
      helper: 'Receivables / 30d revenue',
      status: dsoDays !== null && dsoDays > 35 ? 'warning' : 'good',
    },
    {
      id: 'cycle-time',
      title: 'Order Cycle Time (median)',
      value: cycleMedian !== null ? `${cycleMedian.toLocaleString('he-IL')}d` : '—',
      helper:
        cycleAverage !== null
          ? `Avg ${cycleAverage.toLocaleString('he-IL')}d • ${cycleDurations.length} samples`
          : `${cycleDurations.length} samples`,
      status: cycleMedian !== null && cycleMedian > 14 ? 'warning' : 'good',
    },
    {
      id: 'inventory-turn',
      title: 'Inventory Turnover',
      value: '—',
      helper: 'Inventory costing not wired',
      status: 'info',
    },
    {
      id: 'cac-ltv',
      title: 'CAC vs LTV',
      value: '—',
      helper: 'Acquisition costs not tracked',
      status: 'info',
    },
  ];

  const alerts: AlertItem[] = [];
  if (onTimeRate !== null && onTimeRate < 90) {
    alerts.push({
      id: 'alert-on-time',
      title: 'On-time delivery below 90%',
      description: `${onTimeSample.length - onTimeCount} orders delivered late in last 90d`,
      priority: 'critical',
    });
  }
  if (cycleMedian !== null && cycleMedian > 14) {
    alerts.push({
      id: 'alert-cycle',
      title: 'Order cycle time elevated',
      description: `Median ${cycleMedian} days (avg ${cycleAverage ?? '?'}). Investigate bottlenecks.`,
      priority: 'high',
    });
  }
  if (dsoDays !== null && dsoDays > 40) {
    alerts.push({
      id: 'alert-dso',
      title: 'DSO above threshold',
      description: `Current DSO ${dsoDays} days. Collections attention needed.`,
      priority: 'high',
    });
  }

  return { kpis, alerts };
}
