import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { normalizeOrderStatus, isPendingStatus } from '@/lib/orderStatus';

const orders: any[] = [];

const mockPrisma = {
  order: {
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma, getPrismaClient: () => mockPrisma }));
vi.mock('@/lib/auth/withAuthApiRoute', () => ({ withAuthApiRoute: (handler: any) => handler }));
vi.mock('@/lib/api-middleware', async () => {
  const actual = await vi.importActual<any>('@/lib/api-middleware');
  return {
    ...actual,
    withAuth: (handler: any) => handler,
    validateRequest: () => () => ({}),
  };
});
vi.mock('@/lib/cache/CacheService', () => ({
  createCacheService: () => ({ isAvailable: () => false, get: vi.fn(), set: vi.fn(), invalidate: vi.fn() }),
}));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/services/audit/AuditService', () => ({ AuditService: class {} }));
vi.mock('@/lib/repositories/customers/CustomersRepository', () => ({ CustomersRepository: class {} }));
vi.mock('@/lib/repositories/products/ProductsRepository', () => ({ ProductsRepository: class {} }));
vi.mock('@/domain/orders/normalizeOrder', () => ({ normalizeOrder: (order: any) => order }));

function buildOrder(partial: Partial<any>) {
  return {
    id: `order-${orders.length + 1}`,
    number: `ORD-${orders.length + 1}`,
    status: 'DRAFT',
    totalCents: 1000,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    demo: false,
    deletedAt: null,
    customerName: 'Test Customer',
    ...partial,
  };
}

function filterOrders(where: any = {}) {
  return orders.filter((order) => {
    if (where.deletedAt === null && order.deletedAt) return false;
    if (typeof where.demo === 'boolean' && order.demo !== where.demo) return false;
    if (where.status?.in && !where.status.in.includes(order.status)) return false;
    return true;
  });
}

function resetMockPrisma() {
  mockPrisma.order.groupBy.mockImplementation(({ where }: any) => {
    const grouped = new Map<string, number>();
    filterOrders(where).forEach((order) => {
      grouped.set(order.status, (grouped.get(order.status) ?? 0) + 1);
    });
    return Array.from(grouped.entries()).map(([status, count]) => ({ status, _count: { id: count } }));
  });

  mockPrisma.order.aggregate.mockImplementation(({ where, _sum }: any) => {
    const total = filterOrders(where).reduce((sum, order) => sum + (order.totalCents ?? 0), 0);
    return { _sum: { totalCents: _sum?.totalCents ? total : null } };
  });

  mockPrisma.order.findMany.mockImplementation(({ where, take, orderBy, include }: any) => {
    let results = filterOrders(where).slice();
    if (orderBy?.createdAt === 'desc') {
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    if (typeof take === 'number') {
      results = results.slice(0, take);
    }
    return results.map((order) => ({
      ...order,
      customer: include?.customer ? { name: order.customerName } : undefined,
    }));
  });

  mockPrisma.order.count.mockImplementation(({ where }: any) => filterOrders(where).length);
}

describe('Dashboard ↔ orders list consistency', () => {
  const originalAppEnv = process.env.APP_ENV;

  beforeEach(async () => {
    process.env.APP_ENV = 'production';
    orders.splice(0, orders.length);
    orders.push(
      buildOrder({ id: 'o1', status: 'DRAFT' }),
      buildOrder({ id: 'o2', status: 'PENDING_APPROVAL' }),
      buildOrder({ id: 'o3', status: 'READY_FOR_INSTALL' }),
      buildOrder({ id: 'o4', status: 'SCHEDULED' }),
      buildOrder({ id: 'o5', status: 'COMPLETED' }),
      buildOrder({ id: 'o6', status: 'TO_DO', demo: true }),
      buildOrder({ id: 'o7', status: 'CONFIRMED', deletedAt: new Date('2024-02-01T00:00:00Z') })
    );

    resetMockPrisma();
    vi.resetModules();
  });

  it('returns aligned totals and status counts', async () => {
    const { GET: dashboardGet } = await import('@/app/api/dashboard/route');
    const { GET: ordersGet } = await import('@/app/api/orders/route');

    const dashboardResponse = await dashboardGet(new NextRequest('http://localhost/api/dashboard'));
    const dashboardBody = await dashboardResponse.json();

    const ordersResponse = await ordersGet(new NextRequest('http://localhost/api/orders?limit=50'));
    const ordersBody = await ordersResponse.json();

    const listStatuses = (ordersBody.data as any[]).map((order) => normalizeOrderStatus(order.status));
    const statusCountsFromList = listStatuses.reduce<Record<string, number>>((acc, status) => {
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    expect(dashboardBody.data.summary.totalOrders).toBe((ordersBody.data as any[]).length);
    expect(dashboardBody.data.summary.totalOrders).toBe(5);
    expect((ordersBody.data as any[]).find((order) => order.id === 'o6')).toBeUndefined();
    expect((ordersBody.data as any[]).find((order) => order.id === 'o7')).toBeUndefined();

    dashboardBody.data.statusCounts.forEach((entry: any) => {
      expect(entry.count).toBe(statusCountsFromList[entry.status] ?? 0);
    });

    const pendingFromList = listStatuses.reduce(
      (sum, status) => (isPendingStatus(status as any) ? sum + 1 : sum),
      0
    );
    expect(dashboardBody.data.summary.pendingOrders).toBe(pendingFromList);
    expect(dashboardBody.data.summary.pendingOrders).toBe(4);
  });

  afterEach(() => {
    process.env.APP_ENV = originalAppEnv;
  });
});
