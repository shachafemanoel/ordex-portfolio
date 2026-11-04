import { getManagementOverviewData } from '@/services/managementOverviewService';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const orderCountMock = vi.fn();
const orderAggregateMock = vi.fn();
const orderGroupByMock = vi.fn();
const orderFindManyMock = vi.fn();

const customerCountMock = vi.fn();
const customerFindManyMock = vi.fn();

const skuCountMock = vi.fn();
const skuFindManyMock = vi.fn();

const orderItemGroupByMock = vi.fn();

const userCountMock = vi.fn();
const userGroupByMock = vi.fn();
const userFindManyMock = vi.fn();

const transactionMock = vi.fn(async (operations: unknown[]) => Promise.all(operations));

vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      count: orderCountMock,
      aggregate: orderAggregateMock,
      groupBy: orderGroupByMock,
      findMany: orderFindManyMock,
    },
    customer: {
      count: customerCountMock,
      findMany: customerFindManyMock,
    },
    sku: {
      count: skuCountMock,
      findMany: skuFindManyMock,
    },
    orderItem: {
      groupBy: orderItemGroupByMock,
    },
    user: {
      count: userCountMock,
      groupBy: userGroupByMock,
      findMany: userFindManyMock,
    },
    $transaction: transactionMock,
  },
}));

describe('ManagementOverviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    orderCountMock.mockResolvedValueOnce(42).mockResolvedValueOnce(12);
    orderAggregateMock.mockResolvedValue({ _sum: { totalCents: 420000 } });
    orderGroupByMock
      .mockResolvedValueOnce([{ status: 'PO_CREATED', _count: { _all: 5 } }])
      .mockResolvedValueOnce([
        { assignedUserId: 'user-1', _count: { _all: 3 }, _sum: { totalCents: 123000 } },
      ]);
    orderFindManyMock.mockResolvedValue(
      Array.from({ length: 3 }, (_, idx) => ({
        createdAt: new Date(Date.now() - idx * 24 * 60 * 60 * 1000),
      }))
    );

    customerCountMock.mockResolvedValueOnce(20).mockResolvedValueOnce(5).mockResolvedValueOnce(4);
    customerFindManyMock
      .mockResolvedValueOnce([
        { id: 'cust-1', name: 'גלית', phone: '050', ordersCount: 2, createdAt: new Date() },
      ])
      .mockResolvedValueOnce([{ id: 'cust-2', name: 'רון', clvCents: 330000, ordersCount: 6 }]);

    skuCountMock.mockResolvedValue(15);
    skuFindManyMock.mockResolvedValue([
      { id: 'sku-1', code: 'SKU-1', name: 'כורסא', stock: 1, reorderLevel: 3 },
      { id: 'sku-2', code: 'SKU-2', name: 'ספה', stock: 10, reorderLevel: 0 },
    ]);

    orderItemGroupByMock.mockResolvedValue([
      { sku: 'SKU-1', name: 'כורסא', _sum: { qty: 7, totalCents: 210000 } },
    ]);

    userCountMock.mockResolvedValue(8);
    userGroupByMock.mockResolvedValue([{ role: 'ADMIN', _count: { _all: 2 } }]);
    userFindManyMock.mockResolvedValue([{ id: 'user-1', name: 'Admin', role: 'ADMIN' }]);
  });

  it('returns normalized management overview data without NaN values', async () => {
    const overview = await getManagementOverviewData();

    expect(overview.stats.customers.total).toBe(20);
    expect(overview.stats.orders.total).toBe(42);
    expect(overview.stats.orders.revenue).toBe(4200);
    expect(overview.stats.orders.avgValue).toBeCloseTo(350, 5);

    expect(overview.stats.orders.statusBreakdown).toEqual([{ status: 'AWAITING_STOCK', count: 5 }]);

    const trendCounts = overview.stats.orders.trend.map((entry) => entry.count);
    expect(trendCounts.reduce((sum, value) => sum + value, 0)).toBe(3);

    expect(overview.stats.products.lowStock).toEqual([
      {
        id: 'sku-1',
        code: 'SKU-1',
        name: 'כורסא',
        stock: 1,
        reorderLevel: 3,
        deficit: 2,
      },
    ]);

    expect(overview.stats.products.topSelling[0]).toMatchObject({
      sku: 'SKU-1',
      units: 7,
      revenue: 2100,
    });

    expect(overview.stats.team.roles[0]).toEqual({ role: 'ADMIN', count: 2 });
    expect(overview.stats.team.topPerformers[0]).toMatchObject({
      userId: 'user-1',
      name: 'Admin',
      ordersHandled: 3,
      revenueCents: 123000,
    });
  });
  it('handles null aggregation results gracefully', async () => {
    orderAggregateMock.mockResolvedValue({ _sum: { totalCents: null } }); // Simulate null return
    orderCountMock.mockResolvedValue(0);
    orderGroupByMock.mockResolvedValue([]);

    // Reset other mocks to return empty/defaults
    customerCountMock.mockResolvedValue(0);
    customerFindManyMock.mockResolvedValue([]);
    skuCountMock.mockResolvedValue(0);
    skuFindManyMock.mockResolvedValue([]);
    orderItemGroupByMock.mockResolvedValue([]);
    userCountMock.mockResolvedValue(0);
    userGroupByMock.mockResolvedValue([]);
    userFindManyMock.mockResolvedValue([]);

    const overview = await getManagementOverviewData();

    expect(overview.stats.orders.revenue).toBe(0);
    expect(overview.stats.orders.avgValue).toBe(0);
    expect(overview.stats.team.topPerformers).toEqual([]);
    expect(overview.stats.products.topSelling).toEqual([]);
  });
});
