import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { OrderStatus } from '@prisma/client';

const orderCountMock = vi.fn();
const orderGroupByMock = vi.fn();
const orderAggregateMock = vi.fn();
const orderFindManyMock = vi.fn();
const customerCountMock = vi.fn();
const skuCountMock = vi.fn();
const purchaseOrderFindManyMock = vi.fn();
const statusHistoryFindManyMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      count: orderCountMock,
      groupBy: orderGroupByMock,
      aggregate: orderAggregateMock,
      findMany: orderFindManyMock,
    },
    customer: {
      count: customerCountMock,
    },
    sku: {
      count: skuCountMock,
    },
    purchaseOrder: {
      findMany: purchaseOrderFindManyMock,
    },
    statusHistory: {
      findMany: statusHistoryFindManyMock,
    },
  },
}));

import { getDashboardMetrics } from '@/lib/db/queries/dashboard-metrics';

const now = new Date('2024-05-15T00:00:00Z');

const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe('getDashboardMetrics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    orderCountMock.mockResolvedValueOnce(3); // totalOrders
    orderCountMock.mockResolvedValueOnce(1); // ordersWaitingForStock
    orderCountMock.mockResolvedValueOnce(2); // ordersWaitingForInstallation
    orderCountMock.mockResolvedValueOnce(2); // pendingPayments
    orderCountMock.mockResolvedValueOnce(4); // onTimeDeliveries
    orderCountMock.mockResolvedValueOnce(5); // totalDeliveries

    orderGroupByMock.mockResolvedValue([
      { status: OrderStatus.SUPPLIED, _count: { id: 2 } },
      { status: OrderStatus.DRAFT, _count: { id: 1 } },
    ]);

    orderAggregateMock.mockResolvedValueOnce({ _sum: { totalCents: 45000 } }); // revenue
    orderAggregateMock.mockResolvedValueOnce({ _sum: { totalCents: 15000 } }); // pending payments value
    orderAggregateMock.mockResolvedValueOnce({ _sum: { totalCents: 15000 } }); // receivables for DSO

    orderFindManyMock.mockResolvedValue([
      { createdAt: daysAgo(5), updatedAt: daysAgo(3) },
      { createdAt: daysAgo(2), updatedAt: now },
    ]);

    customerCountMock.mockResolvedValue(2);

    skuCountMock.mockResolvedValueOnce(5); // in stock
    skuCountMock.mockResolvedValueOnce(1); // out of stock
    skuCountMock.mockResolvedValueOnce(2); // low stock

    purchaseOrderFindManyMock.mockResolvedValue([
      {
        id: 'po-1',
        status: 'DRAFT',
        createdAt: daysAgo(20),
        items: [
          { id: 'poi-1', qtyOrdered: 2, product: { basePriceCents: 1000 } },
          { id: 'poi-2', qtyOrdered: 1, product: { basePriceCents: 2000 } },
        ],
      },
      {
        id: 'po-2',
        status: 'PARTIALLY_RECEIVED',
        createdAt: daysAgo(5),
        items: [{ id: 'poi-3', qtyOrdered: 3, product: { basePriceCents: 1500 } }],
      },
    ]);

    statusHistoryFindManyMock.mockResolvedValue([
      {
        id: 'sh-1',
        orderId: 'order-1',
        toStatus: OrderStatus.SUPPLIED,
        createdAt: now,
        order: { number: 'ORD-1' },
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns calculated dashboard metrics using existing schema fields', async () => {
    const metrics = await getDashboardMetrics();

    expect(metrics.totalRevenue).toBe(450);
    expect(metrics.avgOrderValue).toBeCloseTo(150);
    expect(metrics.ordersByStatus[OrderStatus.SUPPLIED]).toBe(2);
    expect(metrics.productsInStock).toBe(5);
    expect(metrics.productsOutOfStock).toBe(1);
    expect(metrics.productsLowStock).toBe(2);
    expect(metrics.openPurchaseOrders).toBe(2);
    expect(metrics.purchaseOrdersValue).toBeCloseTo(85);
    expect(metrics.overduePurchaseOrders).toBe(1);
    expect(metrics.onTimeDeliveryRate).toBe(80);
    expect(metrics.avgOrderProcessingTime).toBe(2);
    expect(metrics.pendingPaymentsValue).toBe(150);
    expect(metrics.recentEvents).toHaveLength(1);
  });
});
