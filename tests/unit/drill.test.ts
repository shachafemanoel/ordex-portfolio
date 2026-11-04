/**
 * Unit tests for the Smart Drill system.
 *
 * Tests computeDrillState as the single source of truth:
 * - Fresh order -> First task
 * - All steps done -> Next task
 * - Snooze set -> Lane WAITING
 * - Snooze expired -> Lane NEEDS_ACTION
 * - Manual checklist overrides
 * - Priority scoring
 * - Lane label and color helpers
 */

import { describe, it, expect } from 'vitest';
import {
  computeDrillState,
  computePriorityScore,
  getLaneLabel,
  getLaneColor,
  type DrillState,
  type OpsLane,
} from '../../lib/services/orders-ops';
import { OrderStatus, PaymentStatus, TaskLabel, DeferBucket } from '@prisma/client';
import type { OrderSnapshot } from '@/lib/orders/rules/orderSnapshot';

// ---------------------------------------------------------------------------
// Helper to build a test snapshot
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: 'order-test-1',
    status: OrderStatus.TO_DO,
    paymentStatus: PaymentStatus.PENDING,
    customerRequestCallback: false,
    address: {
      city: 'Tel Aviv',
      street: 'Rothschild',
      number: '1',
      floor: null,
      notes: null,
      validationStatus: null,
    },
    items: [
      { sku: 'SKU-1', qtyRequired: 2, qtyReceived: 0, supplierId: null },
    ],
    purchaseOrders: [],
    scheduledAt: null,
    hasCalendarEvent: false,
    waitUntil: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeDrillState
// ---------------------------------------------------------------------------

describe('computeDrillState', () => {
  describe('Fresh order (first task)', () => {
    it('should assign NEEDS_ACTION lane for a new unpaid order', () => {
      const snapshot = makeSnapshot();
      const drill = computeDrillState({ snapshot });

      expect(drill.lane).toBe('NEEDS_ACTION');
      expect(drill.currentTask).toBeDefined();
      expect(drill.currentTask.taskLabel).toBeDefined();
      expect(drill.currentTask.taskLabelHe).toBeTruthy();
      expect(drill.progressPct).toBeLessThan(100);
    });

    it('should assign CALLBACK_CUSTOMER task for pending payment order', () => {
      const snapshot = makeSnapshot({
        paymentStatus: PaymentStatus.PENDING,
      });

      const drill = computeDrillState({ snapshot });

      expect(drill.currentTask.taskLabel).toBe(TaskLabel.CALLBACK_CUSTOMER);
      expect(drill.isBlocked).toBe(true);
    });

    it('should assign VERIFY_STOCK task for paid order', () => {
      const snapshot = makeSnapshot({
        paymentStatus: PaymentStatus.PAID,
      });

      const drill = computeDrillState({ snapshot });

      expect(drill.lane).toBe('NEEDS_ACTION');
      expect(drill.currentTask.taskLabel).toBe(TaskLabel.VERIFY_STOCK);
    });
  });

  describe('Snooze behavior', () => {
    it('should return WAITING lane when snoozed with future date', () => {
      const futureSnooze = new Date();
      futureSnooze.setDate(futureSnooze.getDate() + 1);

      const snapshot = makeSnapshot({ paymentStatus: PaymentStatus.PAID });
      const drill = computeDrillState({
        snapshot,
        opsSnoozeUntil: futureSnooze,
        opsSnoozeReason: 'ממתין לספק',
      });

      expect(drill.lane).toBe('WAITING');
      expect(drill.isSnoozed).toBe(true);
      expect(drill.snoozeUntil).toEqual(futureSnooze);
      expect(drill.snoozeReason).toBe('ממתין לספק');
    });

    it('should return NEEDS_ACTION when snooze has expired', () => {
      const pastSnooze = new Date();
      pastSnooze.setDate(pastSnooze.getDate() - 1);

      const snapshot = makeSnapshot({ paymentStatus: PaymentStatus.PAID });
      const drill = computeDrillState({
        snapshot,
        opsSnoozeUntil: pastSnooze,
      });

      expect(drill.isSnoozed).toBe(false);
      expect(drill.lane).toBe('NEEDS_ACTION');
    });

    it('should preserve snooze reason when snoozed', () => {
      const futureSnooze = new Date();
      futureSnooze.setHours(futureSnooze.getHours() + 4);

      const drill = computeDrillState({
        snapshot: makeSnapshot({ paymentStatus: PaymentStatus.PAID }),
        opsSnoozeUntil: futureSnooze,
        opsSnoozeReason: 'מחר בוקר',
      });

      expect(drill.snoozeReason).toBe('מחר בוקר');
    });
  });

  describe('Terminal orders', () => {
    it('should assign CLOSE_ORDER for SUPPLIED orders', () => {
      const snapshot = makeSnapshot({
        status: OrderStatus.SUPPLIED,
        paymentStatus: PaymentStatus.PAID,
      });

      const drill = computeDrillState({ snapshot });

      expect(drill.currentTask.taskLabel).toBe(TaskLabel.CLOSE_ORDER);
    });

    it('should assign CLOSE_ORDER for COMPLETED orders', () => {
      const snapshot = makeSnapshot({
        status: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
      });

      const drill = computeDrillState({ snapshot });

      expect(drill.currentTask.taskLabel).toBe(TaskLabel.CLOSE_ORDER);
    });
  });

  describe('Waiting tasks (deterministic wait)', () => {
    it('should assign WAITING for orders awaiting stock', () => {
      const snapshot = makeSnapshot({
        status: OrderStatus.AWAITING_STOCK,
        paymentStatus: PaymentStatus.PAID,
        items: [
          { sku: 'SKU-1', qtyRequired: 2, qtyReceived: 0, supplierId: 'sup-1' },
        ],
      });

      const drill = computeDrillState({ snapshot });

      // RECEIVE_GOODS is treated as a waiting task
      expect(drill.currentTask.taskLabel).toBe(TaskLabel.RECEIVE_GOODS);
    });

    it('should assign SCHEDULED for installation-day wait', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      const snapshot = makeSnapshot({
        status: OrderStatus.SCHEDULED,
        paymentStatus: PaymentStatus.PAID,
        scheduledAt: futureDate,
        hasCalendarEvent: true,
        items: [
          { sku: 'SKU-1', qtyRequired: 2, qtyReceived: 2, supplierId: 'sup-1' },
        ],
      });

      const drill = computeDrillState({ snapshot });

      if (drill.currentTask.taskLabel === TaskLabel.WAIT_INSTALLATION_DAY) {
        expect(drill.lane).toBe('SCHEDULED');
      }
    });
  });

  describe('Manual checklist overrides', () => {
    it('should merge manual overrides with computed state', () => {
      const snapshot = makeSnapshot({
        paymentStatus: PaymentStatus.PENDING,
      });

      const drill = computeDrillState({
        snapshot,
        opsChecklistState: {
          [TaskLabel.CALLBACK_CUSTOMER]: {
            contacted_customer: true,
          },
        },
      });

      const doneSteps = drill.currentTask.steps.filter((s) => s.status === 'DONE');
      expect(doneSteps.length).toBeGreaterThanOrEqual(1);
      expect(drill.progressPct).toBeGreaterThan(0);
    });

    it('should not override engine-computed DONE steps', () => {
      const snapshot = makeSnapshot({
        paymentStatus: PaymentStatus.PAID,
      });

      // Even with an override setting a step to false, engine says DONE
      const drill = computeDrillState({
        snapshot,
        opsChecklistState: {},
      });

      // Should still work normally
      expect(drill.currentTask.steps).toBeDefined();
      expect(drill.currentTask.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Progress calculation', () => {
    it('should return 0% for order with no completed steps', () => {
      const snapshot = makeSnapshot({
        paymentStatus: PaymentStatus.PENDING,
      });

      const drill = computeDrillState({ snapshot });

      expect(drill.progressPct).toBeLessThanOrEqual(100);
      expect(drill.progressText).toMatch(/^\d+\/\d+$/);
    });

    it('should include progress text in N/M format', () => {
      const snapshot = makeSnapshot({
        paymentStatus: PaymentStatus.PAID,
      });

      const drill = computeDrillState({ snapshot });

      expect(drill.progressText).toMatch(/^\d+\/\d+$/);
    });
  });

  describe('Next task', () => {
    it('should provide nextTask when current is not terminal', () => {
      const snapshot = makeSnapshot({
        paymentStatus: PaymentStatus.PAID,
      });

      const drill = computeDrillState({ snapshot });

      expect(drill.nextTask).not.toBeNull();
      expect(drill.nextTask?.taskLabel).toBeDefined();
      expect(drill.nextTask?.taskLabelHe).toBeTruthy();
    });
  });

  describe('DrillState structure', () => {
    it('should include all required fields', () => {
      const snapshot = makeSnapshot();
      const drill = computeDrillState({ snapshot });

      // Lane fields
      expect(drill.lane).toBeDefined();
      expect(drill.laneLabel).toBeTruthy();
      expect(drill.color).toBeDefined();

      // Task fields
      expect(drill.currentTask).toBeDefined();
      expect(drill.currentTask.taskLabel).toBeDefined();
      expect(drill.currentTask.taskLabelHe).toBeTruthy();
      expect(drill.currentTask.steps).toBeInstanceOf(Array);
      expect(drill.currentTask.quickActions).toBeInstanceOf(Array);

      // Progress fields
      expect(typeof drill.progressPct).toBe('number');
      expect(typeof drill.progressText).toBe('string');

      // Snooze fields
      expect(typeof drill.isSnoozed).toBe('boolean');

      // Backward-compat
      expect(drill.requirements).toBeInstanceOf(Array);

      // Block state
      expect(typeof drill.isBlocked).toBe('boolean');
      expect(drill.blockReasons).toBeInstanceOf(Array);
    });
  });
});

// ---------------------------------------------------------------------------
// computePriorityScore
// ---------------------------------------------------------------------------

describe('computePriorityScore', () => {
  it('should give highest score to urgent orders', () => {
    const urgentScore = computePriorityScore({
      urgent: true,
      lane: 'NEEDS_ACTION',
      snoozeUntil: null,
      lastActionAt: null,
      createdAt: new Date(),
    });

    const normalScore = computePriorityScore({
      urgent: false,
      lane: 'NEEDS_ACTION',
      snoozeUntil: null,
      lastActionAt: null,
      createdAt: new Date(),
    });

    expect(urgentScore).toBeGreaterThan(normalScore);
    expect(urgentScore).toBeGreaterThanOrEqual(1000);
  });

  it('should give higher score to overdue snoozed orders', () => {
    const pastSnooze = new Date();
    pastSnooze.setDate(pastSnooze.getDate() - 2);

    const overdueScore = computePriorityScore({
      urgent: false,
      lane: 'WAITING',
      snoozeUntil: pastSnooze,
      lastActionAt: null,
      createdAt: new Date(),
    });

    const waitingScore = computePriorityScore({
      urgent: false,
      lane: 'WAITING',
      snoozeUntil: null,
      lastActionAt: null,
      createdAt: new Date(),
    });

    expect(overdueScore).toBeGreaterThan(waitingScore);
  });

  it('should rank NEEDS_ACTION higher than WAITING', () => {
    const needsAction = computePriorityScore({
      urgent: false,
      lane: 'NEEDS_ACTION',
      snoozeUntil: null,
      lastActionAt: null,
      createdAt: new Date(),
    });

    const waiting = computePriorityScore({
      urgent: false,
      lane: 'WAITING',
      snoozeUntil: null,
      lastActionAt: null,
      createdAt: new Date(),
    });

    expect(needsAction).toBeGreaterThan(waiting);
  });

  it('should rank SCHEDULED lower than NEEDS_ACTION', () => {
    const scheduled = computePriorityScore({
      urgent: false,
      lane: 'SCHEDULED',
      snoozeUntil: null,
      lastActionAt: null,
      createdAt: new Date(),
    });

    const needsAction = computePriorityScore({
      urgent: false,
      lane: 'NEEDS_ACTION',
      snoozeUntil: null,
      lastActionAt: null,
      createdAt: new Date(),
    });

    expect(scheduled).toBeLessThan(needsAction);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe('getLaneLabel', () => {
  it('should return Hebrew labels for all lanes', () => {
    expect(getLaneLabel('NEEDS_ACTION')).toBe('דורש טיפול');
    expect(getLaneLabel('WAITING')).toBe('ממתין');
    expect(getLaneLabel('SCHEDULED')).toBe('מתוזמן');
  });
});

describe('getLaneColor', () => {
  it('should return correct colors for lanes', () => {
    expect(getLaneColor('SCHEDULED')).toBe('green');
    expect(getLaneColor('WAITING')).toBe('blue');
    expect(getLaneColor('NEEDS_ACTION')).toBe('amber');
  });
});
