import { describe, it, expect } from 'vitest';
import { getStatusesForView, getViewForStatus, VIEW_META } from '@/lib/orders/view-filter';

describe('getStatusesForView', () => {
  it('returns actionable statuses for today view', () => {
    const statuses = getStatusesForView('today');
    expect(statuses).toContain('TO_DO');
    expect(statuses).toContain('RECEIVED');
    expect(statuses).toContain('CALL_BACK');
    expect(statuses).toContain('INSTALL_SCHEDULING');
    expect(statuses).not.toContain('COMPLETED');
    expect(statuses).not.toContain('AWAITING_STOCK');
  });

  it('returns procurement statuses for inProgress view', () => {
    const statuses = getStatusesForView('inProgress');
    expect(statuses).toContain('PO_CREATED');
    expect(statuses).toContain('AWAITING_STOCK');
    expect(statuses).toContain('PARTIALLY_SUPPLIED');
    expect(statuses).toContain('PROCESSING');
    expect(statuses).not.toContain('TO_DO');
  });

  it('returns scheduled statuses for scheduled view', () => {
    const statuses = getStatusesForView('scheduled');
    expect(statuses).toContain('SCHEDULED');
    expect(statuses).toContain('AWAITING_INSTALL');
    expect(statuses).toContain('IN_TRANSIT');
    expect(statuses).not.toContain('TO_DO');
  });

  it('returns completed statuses for done view', () => {
    const statuses = getStatusesForView('done');
    expect(statuses).toContain('SUPPLIED');
    expect(statuses).toContain('COMPLETED');
    expect(statuses).toContain('CANCELLED');
    expect(statuses).not.toContain('TO_DO');
  });

  it('returns empty array for invalid view', () => {
    const statuses = getStatusesForView('invalid' as any);
    expect(statuses).toEqual([]);
  });
});

describe('getViewForStatus', () => {
  it('maps TO_DO to today', () => {
    expect(getViewForStatus('TO_DO')).toBe('today');
  });

  it('maps CALL_BACK to today', () => {
    expect(getViewForStatus('CALL_BACK')).toBe('today');
  });

  it('maps PO_CREATED to inProgress', () => {
    expect(getViewForStatus('PO_CREATED')).toBe('inProgress');
  });

  it('maps AWAITING_STOCK to inProgress', () => {
    expect(getViewForStatus('AWAITING_STOCK')).toBe('inProgress');
  });

  it('maps SCHEDULED to scheduled', () => {
    expect(getViewForStatus('SCHEDULED')).toBe('scheduled');
  });

  it('maps COMPLETED to done', () => {
    expect(getViewForStatus('COMPLETED')).toBe('done');
  });

  it('maps CANCELLED to done', () => {
    expect(getViewForStatus('CANCELLED')).toBe('done');
  });

  it('maps SUPPLIED to done', () => {
    expect(getViewForStatus('SUPPLIED')).toBe('done');
  });
});

describe('VIEW_META', () => {
  it('has metadata for all four views', () => {
    expect(VIEW_META.today).toBeDefined();
    expect(VIEW_META.inProgress).toBeDefined();
    expect(VIEW_META.scheduled).toBeDefined();
    expect(VIEW_META.done).toBeDefined();
  });

  it('has Hebrew labels', () => {
    expect(VIEW_META.today.labelHe).toBe('היום');
    expect(VIEW_META.done.labelHe).toBe('הושלם');
  });
});
