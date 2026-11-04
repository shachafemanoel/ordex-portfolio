import { describe, it, expect } from 'vitest';
import { computeNextTask, computeWaitingSince } from '@/lib/orders/next-task';

describe('computeNextTask', () => {
  it('returns review_order for TO_DO status', () => {
    const task = computeNextTask('TO_DO');
    expect(task.key).toBe('review_order');
    expect(task.ctaLabelHe).toBeTruthy();
  });

  it('returns contact_customer for CALL_BACK status', () => {
    const task = computeNextTask('CALL_BACK');
    expect(task.key).toBe('contact_customer');
    expect(task.labelHe).toContain('לקוח');
  });

  it('returns send_to_supplier for PO_CREATED status', () => {
    const task = computeNextTask('PO_CREATED');
    expect(task.key).toBe('send_to_supplier');
    expect(task.ctaLabelHe).toContain('ספק');
  });

  it('returns receive_goods for AWAITING_STOCK status', () => {
    const task = computeNextTask('AWAITING_STOCK');
    expect(task.key).toBe('receive_goods');
  });

  it('returns schedule_installation for INSTALL_SCHEDULING status', () => {
    const task = computeNextTask('INSTALL_SCHEDULING');
    expect(task.key).toBe('schedule_installation');
  });

  it('returns done for COMPLETED status', () => {
    const task = computeNextTask('COMPLETED');
    expect(task.key).toBe('done');
  });

  it('returns cancelled for CANCELLED status', () => {
    const task = computeNextTask('CANCELLED');
    expect(task.key).toBe('cancelled');
  });

  it('returns execute_delivery for SCHEDULED status', () => {
    const task = computeNextTask('SCHEDULED');
    expect(task.key).toBe('execute_delivery');
  });

  it('returns resume_order for ON_HOLD status', () => {
    const task = computeNextTask('ON_HOLD');
    expect(task.key).toBe('resume_order');
  });

  it('returns receive_remaining for PARTIALLY_SUPPLIED status', () => {
    const task = computeNextTask('PARTIALLY_SUPPLIED');
    expect(task.key).toBe('receive_remaining');
  });
});

describe('computeWaitingSince', () => {
  it('returns minutes for recent timestamps', () => {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const result = computeWaitingSince(thirtyMinAgo.toISOString(), now.toISOString());
    expect(result).toMatch(/\d+ דק׳/);
  });

  it('returns hours for same-day timestamps', () => {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const result = computeWaitingSince(threeHoursAgo.toISOString(), now.toISOString());
    expect(result).toMatch(/\d+ שע׳/);
  });

  it('returns days for older timestamps', () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const result = computeWaitingSince(twoDaysAgo.toISOString(), now.toISOString());
    expect(result).toMatch(/\d+ ימים/);
  });

  it('returns "יום" for exactly 1 day', () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const result = computeWaitingSince(oneDayAgo.toISOString(), now.toISOString());
    expect(result).toBe('יום');
  });

  it('uses createdAt when lastActionAt is null', () => {
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const result = computeWaitingSince(null, fiveHoursAgo.toISOString());
    expect(result).toMatch(/\d+ שע׳/);
  });
});
