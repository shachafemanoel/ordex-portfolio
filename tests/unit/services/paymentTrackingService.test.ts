import { PaymentTrackingService } from '@/services/paymentTrackingService';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOrder = {
  id: 'order-1',
  totalCents: 10000, // $100.00
  paidAmountCents: 0,
  paymentStatus: 'UNPAID',
};

const mockPayment = {
  id: 'pay-1',
  orderId: 'order-1',
  amountCents: 5000,
  currency: 'USD',
  status: 'PAID',
  reference: 'REF-123',
  notes: 'Test payment',
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((arg) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg(prisma);
    }),
  },
}));

vi.mock('@/lib/audit', () => ({
  auditCreate: vi.fn(),
  auditUpdate: vi.fn(),
}));

vi.mock('@/lib/cache/orderCache', () => ({
  invalidateOrderCache: vi.fn(),
}));

import { prisma } from '@/lib/db';

describe('PaymentTrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordPayment', () => {
    it('updates order status to AUTHORIZED (Partial) when amount is less than total', async () => {
      (prisma.order.findUnique as any).mockResolvedValue({ ...mockOrder });
      (prisma.payment.create as any).mockResolvedValue({ ...mockPayment });
      (prisma.order.update as any).mockResolvedValue({
        ...mockOrder,
        paidAmountCents: 5000,
        paymentStatus: 'AUTHORIZED',
        _count: { payments: 1 },
      });

      const result = await PaymentTrackingService.recordPayment({
        orderId: 'order-1',
        amount: 50,
        method: 'CREDIT_CARD',
        reference: 'REF-123',
        userId: 'user-1',
      });

      expect(prisma.payment.create).toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({
            paidAmountCents: 5000,
            paymentStatus: 'AUTHORIZED',
          }),
        })
      );
      expect(result.summary?.paymentStatus).toBe('AUTHORIZED');
    });
  });

  describe('refundPayment', () => {
    it('reduces paid amount and updates status', async () => {
      const paidOrder = {
        ...mockOrder,
        paidAmountCents: 10000,
        paymentStatus: 'PAID',
        _count: { payments: 1 },
      };
      const paymentToRefund = {
        ...mockPayment,
        amountCents: 10000,
        order: paidOrder,
      };

      (prisma.order.findUnique as any).mockResolvedValue(paidOrder);
      (prisma.payment.findUnique as any).mockResolvedValue(paymentToRefund);
      (prisma.payment.update as any).mockResolvedValue({ ...paymentToRefund, status: 'REFUNDED' });
      (prisma.order.update as any).mockResolvedValue({
        ...paidOrder,
        paidAmountCents: 5000,
        paymentStatus: 'AUTHORIZED',
        _count: { payments: 1 },
      });

      const result = await PaymentTrackingService.refundPayment({
        paymentId: 'pay-1',
        amount: 50,
        reason: 'Return',
        userId: 'user-1',
      });

      // First call inside transaction: updates paidAmountCents
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paidAmountCents: 5000,
          }),
        })
      );

      // Second call: updates paymentStatus
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentStatus: 'AUTHORIZED',
          }),
        })
      );

      expect(result.summary?.outstandingBalance).toBe(50);
    });
  });
});
