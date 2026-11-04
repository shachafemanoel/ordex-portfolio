import { describe, it, expect } from 'vitest';
import { computeDrillState, OpsLane } from '@/lib/services/orders-ops';
import { TaskLabel, OrderStatus, PaymentStatus } from '@prisma/client';
import { OrderSnapshot } from '@/lib/orders/rules/orderSnapshot';

// Mock snapshot helper
function createSnapshot(overrides: Partial<OrderSnapshot>): OrderSnapshot {
  return {
    id: 'test-id',
    status: OrderStatus.RECEIVED,
    paymentStatus: PaymentStatus.PENDING,
    customerRequestCallback: false,
    address: {
      city: 'Test City',
      street: 'Test St',
      number: '1',
      floor: null,
      notes: null,
      validationStatus: null,
    },
    items: [],
    purchaseOrders: [],
    scheduledAt: null,
    hasCalendarEvent: false,
    waitUntil: null,
    ...overrides,
  };
}

describe('computeDrillState', () => {
  it('should identify NEEDS_ACTION lane for unpaid order', () => {
    const snapshot = createSnapshot({ paymentStatus: PaymentStatus.PENDING });
    const result = computeDrillState({ snapshot });

    expect(result.lane).toBe('NEEDS_ACTION');
    // Assuming rule R2/R3 resolves to VERIFY_PAYMENT or CALLBACK based on fields
    // If Unpaid -> usually VERIFY_PAYMENT if callback not requested
  });

  it('should respect snooze override (WAITING lane)', () => {
    const snapshot = createSnapshot({ paymentStatus: PaymentStatus.PENDING });
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 24);

    const result = computeDrillState({
      snapshot,
      opsSnoozeUntil: futureDate,
    });

    expect(result.lane).toBe('WAITING');
    expect(result.isSnoozed).toBe(true);
  });

  it('should transition to NEEDS_ACTION if snooze expired', () => {
    const snapshot = createSnapshot({ paymentStatus: PaymentStatus.PENDING });
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 24);

    const result = computeDrillState({
      snapshot,
      opsSnoozeUntil: pastDate,
    });

    // Should ignore expired snooze
    expect(result.lane).toBe('NEEDS_ACTION');
    expect(result.isSnoozed).toBe(false);
  });

  it('should identify WAITING lane for deterministic wait (e.g. AWAITING_STOCK)', () => {
    // Assuming rule R5: AWAITING_STOCK -> WAIT_SUPPLIER_DELIVERY
    const snapshot = createSnapshot({
        status: OrderStatus.AWAITING_STOCK,
        paymentStatus: PaymentStatus.PAID
    });

    const result = computeDrillState({ snapshot });

    // In our new logic, WAIT_SUPPLIER_DELIVERY or RECEIVE_GOODS maps to WAITING lane
    expect(result.lane).toBe('WAITING');
    // Rule R5 actually maps AWAITING_STOCK to RECEIVE_GOODS, so we expect that
    expect(result.currentTask.taskLabel).toBe(TaskLabel.RECEIVE_GOODS);
  });

  it('should allow schedule quick action while waiting for supplier', () => {
    const snapshot = createSnapshot({
      status: OrderStatus.AWAITING_STOCK,
      paymentStatus: PaymentStatus.PAID,
    });

    const result = computeDrillState({ snapshot });
    const actionIds = result.currentTask.quickActions.map((action) => action.id);

    expect(actionIds).toContain('schedule-installation');
  });

  it('should identify SCHEDULED lane for AWAITING_INSTALL (WAIT_INSTALLATION_DAY)', () => {
    // Assuming rule R8: AWAITING_INSTALL -> WAIT_INSTALLATION_DAY
    const snapshot = createSnapshot({
        status: OrderStatus.AWAITING_INSTALL,
        paymentStatus: PaymentStatus.PAID,
        scheduledAt: new Date(), // Has date
    });

    const result = computeDrillState({ snapshot });

    // In our new logic, WAIT_INSTALLATION_DAY maps to SCHEDULED lane
    expect(result.lane).toBe('SCHEDULED');
    expect(result.currentTask.taskLabel).toBe(TaskLabel.WAIT_INSTALLATION_DAY);
  });

  it('should calculate progress correctly based on checklist', () => {
    // Force a task with known checklist
    // Mocking resolvesTaskState is tricky without mocking the module.
    // We rely on the real rules engine here.
    // Let's use CALLBACK_CUSTOMER (R2) which usually has "Call Logged" check.
    const snapshot = createSnapshot({
        customerRequestCallback: true,
        status: OrderStatus.CALL_BACK,
        // Ensure address is missing so "missing_details_completed" is NOT done
        address: {
            city: null,
            street: null,
            number: null,
            floor: null,
            notes: null,
            validationStatus: null
        }
    });

    // Initial state: 0 progress
    const result1 = computeDrillState({ snapshot });
    expect(result1.progressPct).toBe(0); // Assuming no steps done

    // Simulate checklist override (manual step done)
    // NOTE: Rule engine might define this as DB field?
    // Usually "Call Logged" checks order notes or similar.
    // If it's a manual check (not DB field), we can override it.
    // The ID in rulesTable for CALLBACK_CUSTOMER is 'contacted_customer'
    const override = { [TaskLabel.CALLBACK_CUSTOMER]: { 'contacted_customer': true } };

    const result2 = computeDrillState({
        snapshot,
        opsChecklistState: override
    });

    // Progress should increase
    expect(result2.progressPct).toBeGreaterThan(0);
  });
});
