import { dashboardCache } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { getStatusLabel, normalizeOrderStatus } from '@/lib/orderStatus';
import { MapService, type OrdersMapResponse } from '@/lib/services/map/MapService';
import {
  getInstallationsPendingCount,
  getOrderStatusMetrics,
} from '@/lib/services/orders/orderMetrics';
import { getProductionOrdersService } from '@/lib/services/production';
import { percentChange } from '@/lib/utils/kpi';
import { OrderStatus } from '@prisma/client';

export interface DashboardKpis {
  revenue: number;
  activeOrders: number;
  newInstallations: number;
  newCustomers: number;
  monthlyGrowth: number;
}

export interface DashboardRecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  city: string | null;
  status: string;
  statusLabel: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  statusCounts: Record<string, number>;
  recentOrders: DashboardRecentOrder[];
  mapPins: OrdersMapResponse;
}

export interface DashboardParams {
  range?: 'month' | 'all';
  recentOrdersLimit?: number;
  mapLimit?: number;
}

// TTLs: KPIs 60–180s, recent orders 30–120s, map pins 30–120s.
const KPI_TTL_SECONDS = 120;
const RECENT_ORDERS_TTL_SECONDS = 60;
const MAP_PINS_TTL_SECONDS = 60;
const CACHE_VERSION = 'v1';

const isDev = process.env.NODE_ENV !== 'production';

function buildCacheKey(section: string, suffix: string) {
  return `dashboard:${CACHE_VERSION}:${section}:${suffix}`;
}

async function cacheReadThrough<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await dashboardCache.get(key);
  if (cached !== null && cached !== undefined) {
    if (isDev) {
      console.info('[dashboard cache] hit', { key });
    }
    return cached as T;
  }

  if (isDev) {
    console.info('[dashboard cache] miss', { key });
  }

  const fresh = await fetcher();
  await dashboardCache.set(key, fresh, ttlSeconds);
  return fresh;
}

function getDateRangeLabel(range: 'month' | 'all'): { label: string; startOfMonth: Date } {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return { label: range === 'month' ? 'current-month' : 'all-time', startOfMonth };
}

function toStatusCountRecord(counts: Record<string, number>) {
  return Object.entries(counts).reduce<Record<string, number>>((acc, [status, count]) => {
    acc[status] = count;
    return acc;
  }, {});
}

function normalizeMapPins(mapData: OrdersMapResponse): OrdersMapResponse {
  return {
    type: 'FeatureCollection',
    features: mapData.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        createdAt: feature.properties.createdAt
          ? new Date(feature.properties.createdAt).toISOString()
          : undefined,
      },
    })),
  };
}

export async function getDashboardData({
  range = 'month',
  recentOrdersLimit = 10,
  mapLimit = 200,
}: DashboardParams = {}): Promise<DashboardData> {
  const ordersService = getProductionOrdersService();
  const mapService = new MapService();
  const { label, startOfMonth } = getDateRangeLabel(range);

  const kpisKey = buildCacheKey('kpis', label);
  const recentOrdersKey = buildCacheKey('recentOrders', `${label}:${recentOrdersLimit}`);
  const mapPinsKey = buildCacheKey('mapPins', `${label}:${mapLimit}`);

  const kpis = await cacheReadThrough(kpisKey, KPI_TTL_SECONDS, async () => {
    const statusMetrics = await getOrderStatusMetrics();
    const totalRevenueAgg = await prisma.order.aggregate({
      where: {
        status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
      },
      _sum: { totalCents: true },
    });

    const currentMonthRevenueAgg = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfMonth },
        status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
      },
      _sum: { totalCents: true },
    });

    const lastMonthStart = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - 1, 1);
    const lastMonthEnd = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), 0);

    const lastMonthRevenueAgg = await prisma.order.aggregate({
      where: {
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
      },
      _sum: { totalCents: true },
    });

    const newCustomers = await prisma.customer
      .count({
        where: { createdAt: { gte: startOfMonth } },
      })
      .catch(() => 0);

    const newInstallations = await prisma.order
      .count({
        where: {
          createdAt: { gte: startOfMonth },
          status: { in: [OrderStatus.INSTALL_SCHEDULING, OrderStatus.AWAITING_INSTALL] },
        },
      })
      .catch(() => getInstallationsPendingCount(statusMetrics.aggregatedCounts));

    const revenueCents = totalRevenueAgg._sum.totalCents ?? 0;
    const revenue = revenueCents / 100;
    const currentMonthRevenue = (currentMonthRevenueAgg._sum.totalCents ?? 0) / 100;
    const lastMonthRevenue = (lastMonthRevenueAgg._sum.totalCents ?? 0) / 100;

    return {
      revenue,
      activeOrders: statusMetrics.pendingOrders,
      newInstallations,
      newCustomers,
      monthlyGrowth: Number((percentChange(currentMonthRevenue, lastMonthRevenue) ?? 0).toFixed(1)),
    };
  });

  const statusCounts = await cacheReadThrough(
    buildCacheKey('statusCounts', label),
    KPI_TTL_SECONDS,
    async () => {
      const metrics = await getOrderStatusMetrics();
      return toStatusCountRecord(metrics.aggregatedCounts);
    }
  );

  const recentOrders = await cacheReadThrough(
    recentOrdersKey,
    RECENT_ORDERS_TTL_SECONDS,
    async () => {
      const result = await ordersService.listOrders(
        {},
        { limit: recentOrdersLimit, sortBy: 'createdAt:desc' }
      );
      return result.items.map((order) => {
        const status = normalizeOrderStatus(order.status as OrderStatus);
        return {
          id: order.id,
          orderNumber: order.number,
          customerName: order.customer?.name ?? order.customerName ?? 'לא ידוע',
          customerEmail: order.customer?.email ?? order.customerEmail ?? null,
          city: order.city ?? order.shippingAddress?.city ?? null,
          status,
          statusLabel: getStatusLabel(status as OrderStatus),
          totalAmount: order.totalAmount ?? order.total ?? 0,
          createdAt: new Date(order.createdAt).toISOString(),
          updatedAt: new Date(order.updatedAt).toISOString(),
        };
      });
    }
  );

  const mapPins = await cacheReadThrough(mapPinsKey, MAP_PINS_TTL_SECONDS, async () => {
    const mapData = await mapService.getOrdersMap(mapLimit);
    return normalizeMapPins(mapData);
  });

  return {
    kpis: {
      revenue: kpis.revenue,
      activeOrders: kpis.activeOrders,
      newInstallations: kpis.newInstallations,
      newCustomers: kpis.newCustomers,
      monthlyGrowth: kpis.monthlyGrowth,
    },
    statusCounts,
    recentOrders,
    mapPins,
  };
}
