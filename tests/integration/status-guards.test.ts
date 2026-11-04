import { describe, expect, it } from 'vitest';
import { executeGuards } from '@/lib/status-guards';
import { ORDER_STATUS_TRANSITIONS } from '@/lib/orderStatus';

// The readiness rules moved from the legacy READY_FOR_INSTALL / SCHEDULED statuses to the
// MVP flow (READY, then IN_TRANSIT or INSTALLATION). The intent of each case is unchanged.
describe('Status Guards Integration', () => {
  const address = { city: 'תל אביב', street: 'רוטשילד', number: '1' };
  const baseOrder = {
    id: 'order-123',
    status: 'PROCESSING',
    totalCents: 45000, paidAmountCents: 45000, paymentStatus: 'PAID',
    customerName: 'דנה כהן',
    customerPhone: '0521234567',
    items: [] as Array<Record<string, unknown>>,
    shippingAddress: null as typeof address | null,
  };

  describe('READY guards', () => {
    it('blocks the transition while an item is not ready', () => {
      const order = {
        ...baseOrder,
        items: [{ id: '1', received: false, allocationStatus: 'PENDING', qty: 1 }],
        shippingAddress: address,
      };

      const result = executeGuards(order, 'READY');
      expect(result.allPassed).toBe(false);
      expect(result.blockingFailures).toHaveLength(1);
      expect(result.blockingFailures[0].id).toBe('items_ready');
    });

    it('blocks the transition while the address is missing', () => {
      const order = {
        ...baseOrder,
        items: [{ id: '1', received: true, qty: 1 }],
        shippingAddress: null,
      };

      const result = executeGuards(order, 'READY');
      expect(result.allPassed).toBe(false);
      expect(result.blockingFailures).toHaveLength(1);
      expect(result.blockingFailures[0].id).toBe('shipping_address_complete');
    });

    it('passes when every item is ready and the address is complete', () => {
      const order = {
        ...baseOrder,
        items: [
          { id: '1', received: true, qty: 1 },
          { id: '2', received: false, allocationStatus: 'ALLOCATED', qty: 2 },
        ],
        shippingAddress: address,
      };

      expect(executeGuards(order, 'READY').allPassed).toBe(true);
    });
  });

  describe('leaving for delivery or installation', () => {
    it.each(['IN_TRANSIT', 'INSTALLATION'] as const)('blocks %s without a date', (target) => {
      const result = executeGuards({ ...baseOrder, status: 'READY', scheduledAt: null }, target);
      expect(result.allPassed).toBe(false);
      expect(result.blockingFailures.some((failure) => failure.id === 'has_schedule')).toBe(true);
    });

    it.each(['IN_TRANSIT', 'INSTALLATION'] as const)('allows %s once a date is set', (target) => {
      const order = { ...baseOrder, status: 'READY', scheduledAt: new Date().toISOString() };
      expect(executeGuards(order, target).allPassed).toBe(true);
    });
  });

  describe('Transition Matrix', () => {
    it('moves a new order one step forward only', () => {
      expect(ORDER_STATUS_TRANSITIONS.RECEIVED).toContain('PROCESSING');
      expect(ORDER_STATUS_TRANSITIONS.RECEIVED).not.toContain('READY');
      expect(ORDER_STATUS_TRANSITIONS.RECEIVED).not.toContain('COMPLETED');
    });

    it('keeps legacy statuses out of the MVP flow', () => {
      expect(ORDER_STATUS_TRANSITIONS.READY).not.toContain('SCHEDULED');
    });
  });
});
