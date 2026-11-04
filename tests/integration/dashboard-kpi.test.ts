
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '@/lib/services/dashboard/DashboardService';
import { prisma } from '@/lib/db';
import { OrderStatus } from '@prisma/client';

// Mock all dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    customer: {
      aggregate: vi.fn(),
    },
    product: {
      aggregate: vi.fn(),
    },
  },
  getPrismaClient: () => prisma,
}));

vi.mock('@/lib/services/map/MapService', () => ({
  MapService: vi.fn().mockImplementation(() => ({
    getOrdersMap: vi.fn().mockResolvedValue({ features: [] }),
  })),
}));

vi.mock('@/lib/services/events/EventLogService', () => ({
  EventLogService: vi.fn().mockImplementation(() => ({
    fetchEvents: vi.fn().mockResolvedValue({ items: [] }),
  })),
}));

vi.mock('@/src/server/domain/orders/OrdersService', () => ({
  OrdersService: vi.fn().mockImplementation(() => ({
    listOrders: vi.fn().mockResolvedValue({ items: [] }),
  })),
}));

// Mock orderMetrics
vi.mock('@/lib/services/orders/orderMetrics', () => ({
  getOrderStatusMetrics: vi.fn().mockResolvedValue({
    where: {},
    statusCounts: [],
    aggregatedCounts: {},
    totalOrders: 0,
    pendingOrders: 0,
  }),
  getCompletedCount: vi.fn().mockReturnValue(0),
  getInstallationsPendingCount: vi.fn().mockReturnValue(0),
}));

import { getOrderStatusMetrics, getCompletedCount, getInstallationsPendingCount } from '@/lib/services/orders/orderMetrics';

describe('DashboardService KPIs', () => {
  let dashboardService: DashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    dashboardService = new DashboardService();
  });

  it('returns zeros/nulls when no data (empty DB)', async () => {
    // Setup empty responses
    (prisma.order.aggregate as any).mockResolvedValue({ _sum: { totalCents: null } });
    (prisma.customer.aggregate as any).mockResolvedValue({ _count: { id: 0 }, _sum: { clvCents: null } });
    (prisma.product.aggregate as any).mockResolvedValue({ _count: { id: 0 } });
    (prisma.order.groupBy as any).mockResolvedValue([]); // activeCustomersAgg
    (prisma.order.count as any).mockResolvedValue(0); // total/completed count

    const result = await dashboardService.getOverview();

    expect(result.summary.totalRevenue).toBe(0);
    expect(result.summary.totalOrders).toBe(0);
    expect(result.summary.avgOrderValue).toBe(0);
    expect(result.summary.activeCustomers).toBe(0);
    expect(result.summary.monthlyGrowth).toBe(0); // null -> 0 per impl
    expect(result.summary.serviceLevel).toBeNull(); // null for N/A
  });

  it('calculates metrics correctly with data', async () => {
    // Setup mock data
    // statusMetrics
    (getOrderStatusMetrics as any).mockResolvedValue({
      where: {},
      statusCounts: [],
      aggregatedCounts: { COMPLETED: 5 },
      totalOrders: 10,
      pendingOrders: 2,
    });
    (getCompletedCount as any).mockReturnValue(5);
    (getInstallationsPendingCount as any).mockReturnValue(2);

    // Revenue Agg (Current Total)
    (prisma.order.aggregate as any)
      .mockResolvedValueOnce({ _sum: { totalCents: 100000 } }) // Total Revenue (1000.00)
      .mockResolvedValueOnce({ _sum: { totalCents: 60000 } }) // Current Month (600.00)
      .mockResolvedValueOnce({ _sum: { totalCents: 50000 } }); // Last Month (500.00)

    (prisma.customer.aggregate as any).mockResolvedValue({ _count: { id: 20 }, _sum: { clvCents: 200000 } });
    (prisma.product.aggregate as any).mockResolvedValue({ _count: { id: 50 } });

    // Active customers (2 unique IDs)
    (prisma.order.groupBy as any).mockResolvedValue([{ customerId: '1' }, { customerId: '2' }]);

    // Service Level Counts
    (prisma.order.count as any)
      .mockResolvedValueOnce(10) // Total valid orders
      .mockResolvedValueOnce(8);  // Completed/Installed etc.

    const result = await dashboardService.getOverview();

    expect(result.summary.totalRevenue).toBe(1000); // 100000 / 100
    expect(result.summary.totalOrders).toBe(10);
    expect(result.summary.avgOrderValue).toBe(100); // 1000 / 10
    expect(result.summary.activeCustomers).toBe(2);

    // Growth: (600 - 500) / 500 = 0.2 = 20%
    expect(result.summary.monthlyGrowth).toBe(20);

    // Service Level: 8 / 10 = 80%
    expect(result.summary.serviceLevel).toBe(80);
  });
});
