import { describe, it, expect } from 'vitest';
import { deriveStatusFromSnapshot } from '@/lib/services/orders/statusRecalculation';
import { OrderStatus, PaymentStatus } from '@prisma/client';

const baseOrder = {
  id: 'order-rc',
  status: OrderStatus.AWAITING_STOCK,
  totalCents: 1000,
  paidAmountCents: 0,
  paymentStatus: PaymentStatus.PENDING,
  customerName: 'לקוח',
  customerPhone: '0501234567',
  city: 'חיפה',
  shippingAddress: { city: 'חיפה', street: 'הרצל', number: '5' },
  items: [
    { id: 'i1', qty: 1, receivedQuantity: 0, received: false },
    { id: 'i2', qty: 1, receivedQuantity: 0, received: false },
  ],
  installationTasks: [],
  payments: [],
};

describe('deriveStatusFromSnapshot - receipts', () => {
  it('stays awaiting stock when nothing received', () => {
    const result = deriveStatusFromSnapshot(baseOrder as any, [{ id: 'po1', status: 'OPEN' }]);
    expect(result.target).toBe(OrderStatus.AWAITING_STOCK);
  });

  it('moves to partially supplied when some received', () => {
    const order = {
      ...baseOrder,
      items: [
        { id: 'i1', qty: 1, receivedQuantity: 1, received: true },
        { id: 'i2', qty: 1, receivedQuantity: 0, received: false },
      ],
    };
    const result = deriveStatusFromSnapshot(order as any, []);
    expect(result.target).toBe(OrderStatus.PARTIALLY_SUPPLIED);
  });

  it('keeps awaiting stock even when scheduled early and PO is still open', () => {
    const order = {
      ...baseOrder,
      scheduledAt: new Date(Date.now() + 24 * 3600 * 1000),
      assignedUserId: 'tech-1',
      items: [
        { id: 'i1', qty: 1, receivedQuantity: 0, received: false },
        { id: 'i2', qty: 1, receivedQuantity: 0, received: false },
      ],
    };
    const result = deriveStatusFromSnapshot(order as any, [{ id: 'po1', status: 'SENT' }]);
    expect(result.target).toBe(OrderStatus.AWAITING_STOCK);
    expect(result.reason).toContain('המשלוח כבר תואם');
  });

  it('moves to scheduled when all items received and scheduled/assigned', () => {
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
