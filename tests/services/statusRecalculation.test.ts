import { describe, it, expect } from 'vitest';
import { deriveStatusFromSnapshot } from '@/lib/services/orders/statusRecalculation';
import { OrderStatus, PaymentStatus } from '@prisma/client';

const baseOrder = {
  id: 'order-1',
  status: OrderStatus.TO_DO,
  totalCents: 10000,
  paidAmountCents: 0,
  paymentStatus: PaymentStatus.PENDING,
  customerName: 'לקוח בדיקה',
  customerPhone: '0500000000',
  city: 'תל אביב',
  shippingAddress: {
    city: 'תל אביב',
    street: 'בן גוריון',
    number: '10',
  },
  items: [
    { id: 'i1', qty: 2, receivedQuantity: 0, received: false },
    { id: 'i2', qty: 1, receivedQuantity: 0, received: false },
  ],
  installationTasks: [],
  payments: [],
};

describe('deriveStatusFromSnapshot', () => {
  it('falls back to CALL_BACK when contact info missing', () => {
    const order = { ...baseOrder, customerPhone: '' };
    const result = deriveStatusFromSnapshot(order as any, []);
    expect(result.target).toBe(OrderStatus.CALL_BACK);
  });

  it('returns PARTIALLY_SUPPLIED when some items received', () => {
    const order = {
      ...baseOrder,
      items: [
        { id: 'i1', qty: 2, receivedQuantity: 1, received: false },
        { id: 'i2', qty: 1, receivedQuantity: 0, received: false },
      ],
    };
    const result = deriveStatusFromSnapshot(order as any, []);
    expect(result.target).toBe(OrderStatus.PARTIALLY_SUPPLIED);
  });

  it('moves to READY_FOR_INSTALL when all items received and not scheduled', () => {
    const order = {
      ...baseOrder,
      items: [
        { id: 'i1', qty: 1, receivedQuantity: 1, received: true },
        { id: 'i2', qty: 1, receivedQuantity: 1, received: true },
      ],
    };
    const result = deriveStatusFromSnapshot(order as any, []);
    expect(result.target).toBe(OrderStatus.READY_FOR_INSTALL);
  });

  it('moves to SCHEDULED when items ready and scheduled', () => {
    const order = {
      ...baseOrder,
      items: [
        { id: 'i1', qty: 1, receivedQuantity: 1, received: true },
        { id: 'i2', qty: 1, receivedQuantity: 1, received: true },
      ],
      scheduledAt: new Date(Date.now() + 3600 * 1000),
      assignedUserId: 'tech-1',
    };
    const result = deriveStatusFromSnapshot(order as any, []);
    expect(result.target).toBe(OrderStatus.SCHEDULED);
  });
});
