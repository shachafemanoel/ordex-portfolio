import { describe, it, expect } from 'vitest';
import { executeGuards } from '@/lib/status-guards';
import { hasFullPayment } from '@/lib/workflow-requirements';

const ready = { status: 'READY', scheduledAt: new Date(), totalCents: 45000, paidAmountCents: 45000, paymentStatus: 'PAID' };
describe('departure payment conditions', () => {
  it.each(['IN_TRANSIT','INSTALLATION'] as const)('requires complete payment before %s', target => {
    expect(executeGuards(ready,target).allPassed).toBe(true);
    for (const order of [ {...ready,paidAmountCents:0}, {...ready,paidAmountCents:44999}, {...ready,paymentStatus:'AUTHORIZED'}, {...ready,paymentStatus:'PENDING'} ]) {
      expect(executeGuards(order,target).blockingFailures.map(f=>f.id)).toContain('full_payment');
    }
  });
  it('blocks a paid order with a store review flag', () => {
    expect(executeGuards({...ready,sourceReviewReason:'STORE_CANCELLATION_OR_REFUND'},'IN_TRANSIT').blockingFailures.map(f=>f.id)).toContain('store_review');
  });
  it('does not treat missing or fractional values as payment evidence', () => {
    expect(hasFullPayment({})).toBe(false);
    expect(hasFullPayment({...ready,paidAmountCents:45000.1})).toBe(false);
    expect(hasFullPayment({...ready,totalCents:-1})).toBe(false);
  });
});
