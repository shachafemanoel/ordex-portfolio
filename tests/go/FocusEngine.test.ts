import { describe, it, expect, vi } from 'vitest';
import { FocusEngine } from '@/lib/services/go/FocusEngine';

// Mock prisma to avoid DB connection during import side-effects
vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
  },
}));

describe('FocusEngine', () => {
  describe('checkOrder', () => {
    it('should return ADDRESS reason if shipping address is missing', () => {
      const order = {
        status: 'RECEIVED',
        totalCents: 100,
        paidAmountCents: 100,
        shippingAddress: null,
      };
      const reasons = FocusEngine.checkOrder(order);
      expect(reasons).toHaveLength(1);
      expect(reasons[0].type).toBe('ADDRESS');
    });

    it('should return ADDRESS reason if shipping address is incomplete', () => {
        const order = {
          status: 'RECEIVED',
          totalCents: 100,
          paidAmountCents: 100,
          shippingAddress: { street: '', city: 'City' },
        };
        const reasons = FocusEngine.checkOrder(order);
        expect(reasons).toHaveLength(1);
        expect(reasons[0].type).toBe('ADDRESS');
      });

    it('should return PAYMENT reason if not paid', () => {
      const order = {
        status: 'RECEIVED',
        totalCents: 100,
        paidAmountCents: 0,
        shippingAddress: { street: 'Main St', city: 'City' },
      };
      const reasons = FocusEngine.checkOrder(order);
      expect(reasons).toHaveLength(1);
      expect(reasons[0].type).toBe('PAYMENT');
    });

    it('should return SCHEDULE reason if in INSTALL_SCHEDULING but no date', () => {
      const order = {
        status: 'INSTALL_SCHEDULING',
        totalCents: 100,
        paidAmountCents: 100,
        shippingAddress: { street: 'Main St', city: 'City' },
        scheduledAt: null,
      };
      const reasons = FocusEngine.checkOrder(order);
      expect(reasons).toHaveLength(1);
      expect(reasons[0].type).toBe('SCHEDULE');
    });

    it('should return STOCK reason if awaiting install but items not received', () => {
      const order = {
        status: 'AWAITING_INSTALL',
        totalCents: 100,
        paidAmountCents: 100,
        shippingAddress: { street: 'Main St', city: 'City' },
        scheduledAt: new Date(),
        items: [{ received: false }, { received: true }],
      };
      const reasons = FocusEngine.checkOrder(order);
      expect(reasons).toHaveLength(1);
      expect(reasons[0].type).toBe('STOCK');
      expect(reasons[0].message).toContain('1');
    });

    it('should return empty list if all good', () => {
      const order = {
        status: 'READY_FOR_INSTALL',
        totalCents: 100,
        paidAmountCents: 100,
        shippingAddress: { street: 'Main St', city: 'City' },
        scheduledAt: new Date(),
        items: [{ received: true }],
      };
      const reasons = FocusEngine.checkOrder(order);
      expect(reasons).toHaveLength(0);
    });
  });
});
