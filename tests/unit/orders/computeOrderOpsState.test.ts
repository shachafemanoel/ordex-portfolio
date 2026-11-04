import { describe, expect, it } from 'vitest';
import { computeOrderOpsState } from '@/lib/orders/ops/computeOrderOpsState';

describe('computeOrderOpsState', () => {
  it('should return NEEDS_ACTION and "New Order" for recently created order', () => {
    const order = {
      id: '1',
      status: 'RECEIVED',
      statusUpdatedAt: new Date().toISOString(),
      scheduledAt: null,
      items: [],
    } as any;

    const state = computeOrderOpsState(order);
    expect(state.lane).toBe('NEEDS_ACTION');
    expect(state.labelHe).toContain('הזמנה חדשה');
    expect(state.isUrgent).toBe(false);
  });

  it('should return SCHEDULED if already scheduled (future)', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const order = {
      id: '1',
      status: 'SCHEDULED',
      scheduledAt: futureDate.toISOString(),
      items: [],
    } as any;

    const state = computeOrderOpsState(order);
    expect(state.lane).toBe('SCHEDULED');
    expect(state.tone).toBe('success');
  });

  it('should return SCHEDULED if installed (past)', () => {
    const order = {
      id: '1',
      status: 'INSTALLED',
      items: [],
    } as any;

    const state = computeOrderOpsState(order);
    expect(state.lane).toBe('SCHEDULED');
    // Actually typically it might be considered 'Done' but board shows 'Scheduled / In Progress'
  });

  it('should return WAITING if all items ordered and have ETA', () => {
    const order = {
      id: '1',
      status: 'PROCESSING',
      items: [
        {
          id: 'i1',
          sentToSupplierAt: new Date().toISOString(),
          estimatedSupplyAt: new Date().toISOString(),
          qty: 1,
          receivedQuantity: 0,
        },
        {
          id: 'i2',
          sentToSupplierAt: new Date().toISOString(),
          estimatedSupplyAt: new Date().toISOString(),
          qty: 1,
          receivedQuantity: 0,
        },
      ],
    } as any;

    const state = computeOrderOpsState(order);
    expect(state.lane).toBe('WAITING');
    expect(state.labelHe).toBe('ממתין לסחורה');
  });

  it('should return NEEDS_ACTION if items ordered BUT ETA passed', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);

    const order = {
      id: '1',
      status: 'PROCESSING',
      items: [
        {
          id: 'i1',
          sentToSupplierAt: new Date().toISOString(),
          estimatedSupplyAt: pastDate.toISOString(),
          qty: 1,
          receivedQuantity: 0,
        },
      ],
    } as any;

    const state = computeOrderOpsState(order);
    expect(state.lane).toBe('NEEDS_ACTION');
    expect(state.labelHe).toBe('איחור באספקה');
    expect(state.tone).toBe('urgent'); // Urgent because late
    expect(state.isUrgent).toBe(true);
  });

  it('should mark as URGENT if manually flagged', () => {
    const order = {
      id: '1',
      status: 'RECEIVED',
      urgent: true,
      items: [],
    } as any;

    const state = computeOrderOpsState(order);
    expect(state.isUrgent).toBe(true);
  });

  it('should calculate checklist progress', () => {
    // Requirements for NEEEDS_ACTION -> Waiting usually involve ordering items
    // Let's assume checklist logic from config is mocked or we test the output structure
    const order = {
      id: '1',
      status: 'RECEIVED',
      items: [],
    } as any;

    const state = computeOrderOpsState(order);
    expect(state.checklist).toBeDefined();
    // Since we didn't mock status-guards, we expect actual logic.
    // Assuming 'RECEIVED' -> 'PROCESSING' requires nothing special or some checks.
    // We just verify structure exists.
    expect(Array.isArray(state.checklist)).toBe(true);
  });
});
