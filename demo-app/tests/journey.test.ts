import { describe, expect, it } from 'vitest';
import { OrderStatus as S } from '@/lib/order-status-type';
import { blockers, initialOrders, transition } from '@/src/demo';
import { benchState, canDispatch, departureBlockers, guideIndex, nextStatus } from '@/src/journey';

describe('shared guided workflow and order bench', () => {
  it.each(
    [false, true].flatMap((scheduled) => [false, true].map((paid) => [scheduled, paid] as const)),
  )('keeps gate, summary and departure guard aligned: date=%s, paid=%s', (scheduled, paid) => {
    const order = {
      ...initialOrders()[2]!,
      scheduledAt: scheduled ? '2026-12-01' : '',
      paidAmountCents: paid ? 320000 : 0,
      paymentStatus: paid ? 'PAID' : 'PENDING',
    };
    const allowed = blockers(order, S.IN_TRANSIT, '').length === 0;
    expect(canDispatch(order)).toBe(allowed);
    expect(benchState(order).gateOpen).toBe(allowed);
    expect(allowed).toBe(scheduled && paid);
    expect(guideIndex(order)).toBe(!scheduled ? 2 : !paid ? 3 : 4);
  });

  it('does not mark an earlier, held, cancelled or completed order dispatchable', () => {
    const ready = {
      ...initialOrders()[2]!,
      scheduledAt: '2026-12-01',
      paidAmountCents: 320000,
      paymentStatus: 'PAID',
    };
    for (const status of [S.RECEIVED, S.PROCESSING, S.ON_HOLD, S.CANCELLED, S.COMPLETED])
      expect(canDispatch({ ...ready, status })).toBe(false);
    expect(benchState({ ...ready, status: S.PROCESSING }).gateOpen).toBe(false);
    expect(benchState({ ...ready, status: S.ON_HOLD, previousStatus: S.READY })).toMatchObject({
      gateOpen: false,
      held: true,
      station: 2,
    });
    expect(benchState({ ...ready, status: S.CANCELLED })).toMatchObject({
      gateOpen: false,
      cancelled: true,
    });
  });

  it('advances guidance only after the order action actually happens', () => {
    let order = initialOrders()[0]!;
    expect(guideIndex(order)).toBe(0);
    expect(() => transition(order, S.READY, '')).toThrow();
    order = transition(order, S.PROCESSING, '');
    expect(guideIndex(order)).toBe(1);
    order = transition({ ...order, items: [{ allocationStatus: 'ALLOCATED' }] }, S.READY, '');
    expect(guideIndex(order)).toBe(2);
    order = { ...order, scheduledAt: '2026-12-01' };
    expect(guideIndex(order)).toBe(3);
    expect(departureBlockers(order)).toHaveLength(1);
    order = { ...order, paidAmountCents: order.totalCents, paymentStatus: 'PAID' };
    expect(guideIndex(order)).toBe(4);
    order = transition(order, S.IN_TRANSIT, '');
    expect(guideIndex(order)).toBe(5);
    expect(nextStatus(order)).toBe(S.COMPLETED);
    order = transition(order, S.COMPLETED, '');
    expect(guideIndex(order)).toBe(6);
    expect(benchState(order).station).toBe(5);
    expect(nextStatus(order)).toBeUndefined();
  });

  it('normalizes payment column to the selected order total instead of fixed deposits', () => {
    const order = initialOrders()[0]!;
    expect(benchState(order).paidFraction).toBe(0);
    expect(benchState({ ...order, paidAmountCents: order.totalCents / 2 }).paidFraction).toBe(0.5);
    expect(benchState({ ...order, paidAmountCents: order.totalCents }).paidFraction).toBe(1);
    expect(benchState({ ...order, totalCents: 0 }).paidFraction).toBe(1);
  });

  it('keeps installation optional and resumes to the held state', () => {
    expect(nextStatus({ ...initialOrders()[0]!, status: S.IN_TRANSIT })).toBe(S.COMPLETED);
    expect(nextStatus({ ...initialOrders()[0]!, status: S.INSTALLATION })).toBe(S.COMPLETED);
    expect(
      nextStatus({ ...initialOrders()[0]!, status: S.ON_HOLD, previousStatus: S.PROCESSING }),
    ).toBe(S.PROCESSING);
  });

  it('cancelling a held order keeps the crate at its last actual station', () => {
    const ready = initialOrders()[2]!;
    const held = transition(ready, S.ON_HOLD, 'בדיקת השהיה');
    const cancelled = transition(held, S.CANCELLED, 'בדיקת ביטול');
    expect(benchState(cancelled)).toMatchObject({ station: 2, cancelled: true, gateOpen: false });
  });
});
