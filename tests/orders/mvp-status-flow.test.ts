import { describe, expect, it } from 'vitest';
import type { OrderStatus } from '@prisma/client';
import { getDefaultAdvanceTarget } from '@/lib/orderStatus';
import { executeGuards } from '@/lib/status-guards';
import { validateTransition } from '@/lib/status-machine';
import { isItemReady } from '@/lib/workflow-requirements';

// The MVP status flow approved on 28.10.2026:
// RECEIVED → PROCESSING → READY → IN_TRANSIT / INSTALLATION → COMPLETED, plus ON_HOLD and CANCELLED.
const allowed: Array<[OrderStatus, OrderStatus]> = [
  ['RECEIVED', 'PROCESSING'],
  ['PROCESSING', 'READY'],
  ['READY', 'IN_TRANSIT'],
  ['READY', 'INSTALLATION'],
  ['IN_TRANSIT', 'INSTALLATION'],
  ['IN_TRANSIT', 'COMPLETED'],
  ['INSTALLATION', 'COMPLETED'],
  ['PROCESSING', 'RECEIVED'],
  ['READY', 'PROCESSING'],
  ['IN_TRANSIT', 'READY'],
  ['INSTALLATION', 'READY'],
];

const skips: Array<[OrderStatus, OrderStatus]> = [
  ['RECEIVED', 'READY'],
  ['RECEIVED', 'IN_TRANSIT'],
  ['RECEIVED', 'COMPLETED'],
  ['PROCESSING', 'IN_TRANSIT'],
  ['PROCESSING', 'COMPLETED'],
  ['READY', 'COMPLETED'],
  ['COMPLETED', 'PROCESSING'],
  ['CANCELLED', 'RECEIVED'],
];

const openStatuses: OrderStatus[] = ['RECEIVED', 'PROCESSING', 'READY', 'IN_TRANSIT', 'INSTALLATION'];

const address = { city: 'חיפה', street: 'הרצל', number: '5' };
const readyOrder = {
  status: 'PROCESSING',
  customerName: 'דנה כהן',
  customerPhone: '0521234567',
  items: [{ id: 'i1', received: false, allocationStatus: 'ALLOCATED' }],
  shippingAddress: address,
};

const failureIds = (order: Record<string, unknown>, target: OrderStatus) =>
  executeGuards(order, target).blockingFailures.map((failure) => failure.id);

describe('MVP status flow: transitions', () => {
  it.each(allowed)('allows %s → %s', (from, to) => {
    expect(validateTransition(from, to).isValid).toBe(true);
  });

  it.each(skips)('blocks %s → %s', (from, to) => {
    expect(validateTransition(from, to).isValid).toBe(false);
  });

  it.each(openStatuses)('allows holding and cancelling from %s', (from) => {
    expect(validateTransition(from, 'ON_HOLD').isValid).toBe(true);
    expect(validateTransition(from, 'CANCELLED').isValid).toBe(true);
  });

  it('advances to the next step by default, never to hold or cancel', () => {
    expect(getDefaultAdvanceTarget('RECEIVED')).toBe('PROCESSING');
    expect(getDefaultAdvanceTarget('PROCESSING')).toBe('READY');
    expect(getDefaultAdvanceTarget('READY')).toBe('IN_TRANSIT');
    expect(getDefaultAdvanceTarget('INSTALLATION')).toBe('COMPLETED');
    expect(getDefaultAdvanceTarget('COMPLETED')).toBeUndefined();
  });
});

describe('MVP status flow: transition conditions', () => {
  it('PROCESSING needs at least one item, a customer name and a phone', () => {
    expect(failureIds({ ...readyOrder, items: [] }, 'PROCESSING')).toContain('has_items');
    expect(failureIds({ ...readyOrder, customerPhone: '' }, 'PROCESSING')).toContain('customer_contact');
    expect(failureIds({ ...readyOrder, customerName: null, customer: { name: 'דנה', phone: '05' } }, 'PROCESSING')).toEqual([]);
    expect(failureIds(readyOrder, 'PROCESSING')).toEqual([]);
  });

  it('READY needs every item ready and a full address', () => {
    expect(failureIds(readyOrder, 'READY')).toEqual([]);
    expect(failureIds({ ...readyOrder, items: [{ id: 'i1', allocationStatus: 'PENDING' }] }, 'READY')).toEqual(['items_ready']);
    expect(failureIds({ ...readyOrder, items: [] }, 'READY')).toContain('items_ready');
    expect(failureIds({ ...readyOrder, shippingAddress: { ...address, number: '' } }, 'READY')).toEqual(['shipping_address_complete']);
  });

  it.each(['IN_TRANSIT', 'INSTALLATION'] as const)('%s needs a date', (target) => {
    expect(failureIds({ status: 'READY', scheduledAt: null, totalCents: 100, paidAmountCents: 100, paymentStatus: 'PAID' }, target)).toEqual(['has_schedule']);
    expect(failureIds({ status: 'READY', scheduledAt: '2026-11-01T08:00:00.000Z', totalCents: 100, paidAmountCents: 100, paymentStatus: 'PAID' }, target)).toEqual([]);
  });

  it.each(['CANCELLED', 'ON_HOLD'] as const)('%s needs a reason', (target) => {
    expect(failureIds({ status: 'READY' }, target)).toEqual(['reason_required']);
    expect(failureIds({ status: 'READY', reason: '   ' }, target)).toEqual(['reason_required']);
    expect(executeGuards({ status: 'READY' }, target, { additionalData: { reason: 'הלקוח ביקש' } }).allPassed).toBe(true);
  });

  it('explains a blocked transition in Hebrew', () => {
    const [failure] = executeGuards({ status: 'READY' }, 'IN_TRANSIT').blockingFailures;
    expect(failure.message).toMatch(/תאריך/);
  });
});

describe('isItemReady', () => {
  it('accepts stock allocation or a supplier receipt', () => {
    expect(isItemReady({ received: true })).toBe(true);
    expect(isItemReady({ allocationStatus: 'ALLOCATED' })).toBe(true);
    expect(isItemReady({ received: false, allocationStatus: 'PENDING' })).toBe(false);
    expect(isItemReady({ allocationStatus: 'ON_ORDER' })).toBe(false);
  });
});
