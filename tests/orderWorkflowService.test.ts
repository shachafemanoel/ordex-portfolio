import { OrderWorkflowService } from '@/services/orderWorkflowService';
import type { OrderStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOrder = {
  id: 'order-1',
  number: '1001',
  status: 'DRAFT' as OrderStatus,
  statusRaw: 'DRAFT',
  customerId: 'cust-1',
  customer: {
    id: 'cust-1',
    fullName: 'לקוח בדיקה',
    phone: '050-0000000',
    email: 'test@example.com',
    city: 'תל אביב',
    street: 'דרך השלום',
    houseNumber: '10',
  },
  billingAddress: {
    id: 'addr-1',
    city: 'תל אביב',
    street: 'דרך השלום',
    number: '10',
  },
  shippingAddress: {
    id: 'addr-2',
    city: 'תל אביב',
    street: 'דרך השלום',
    number: '10',
  },
  items: [
    {
      id: 'item-1',
      name: 'שולחן',
      qty: 1,
      totalCents: 100000,
      priceCents: 100000,
      productId: 'prod-1',
      received: false,
      product: { defaultSupplierId: null },
    },
  ],
  payments: [],
  assignedUserId: 'user-1',
  assignedUser: { id: 'user-1', name: 'מנהל' },
  noteEntries: [{ id: 'note-1' }],
  shipments: [],
  calendarEvents: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock('@/lib/db', () => ({
  prisma: {
    order: { findUnique: vi.fn(() => Promise.resolve({ ...mockOrder })) },
    purchaseOrder: { findMany: vi.fn(() => Promise.resolve([])) },
  },
}));

vi.mock('@/lib/business-logic', () => ({
  OrderStatusManager: {
    changeOrderStatus: vi.fn(() =>
      Promise.resolve({ order: mockOrder, historyEntry: null, triggeredActions: [] })
    ),
  },
}));

const { prisma } = await import('@/lib/db');
const { OrderStatusManager } = await import('@/lib/business-logic');

describe('OrderWorkflowService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns workflow state with the order dto', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({ ...mockOrder });
    const result = await OrderWorkflowService.getOrderWithWorkflow('order-1');
    expect(result.order.id).toBe('order-1');
    expect(result.order.total).toBe(1000); // 100,000 cents / 100
    expect(result.order.items[0].pricePerUnit).toBe(1000);
    expect(result.order.items[0].total).toBe(1000);
    expect(result.workflow.status).toBe('DRAFT');
    expect(result.workflow.requirements.length).toBeGreaterThan(0);
    expect(result.context.purchaseOrders).toEqual([]);
  });

  it('includes workflow context data for downstream modules', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({ ...mockOrder });
    (prisma.purchaseOrder.findMany as any).mockResolvedValue([
      {
        id: 'po-1',
        reference: 'PO-1',
        status: 'SENT',
        supplier: { name: 'ספק בדיקה' },
        GoodsReceipt: [],
      },
    ]);
    const result = await OrderWorkflowService.getOrderWithWorkflow('order-1');
    expect(result.context.purchaseOrders).toHaveLength(1);
    expect(result.context.outstandingBalance).toBeDefined();
  });

  it('rejects invalid transitions based on requirements', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({ ...mockOrder });
    await expect(
      OrderWorkflowService.changeStatus({
        orderId: 'order-1',
        targetStatus: 'READY_FOR_INSTALL',
        reason: 'בדיקה',
        userId: 'user-1',
      })
    ).rejects.toThrowError();
    expect(OrderStatusManager.changeOrderStatus).not.toHaveBeenCalled();
  });
});
