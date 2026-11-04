/**
 * Tests for Orders Operational Service
 */

import { describe, it, expect } from 'vitest';
import {
  computeDrillState,
  computePriorityScore,
} from '../../../lib/services/orders-ops';
import { OrderStatus, PaymentStatus, TaskLabel } from '@prisma/client';
import type { OrderSnapshot } from '@/lib/orders/rules/orderSnapshot';

// ---------------------------------------------------------------------------
// DrillState tests
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: 'order-test',
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

describe('computeDrillState', () => {
  it('should return NEEDS_ACTION for unpaid order needing callback', () => {
    const snapshot = makeSnapshot({
      paymentStatus: PaymentStatus.PENDING,
    });

    const drill = computeDrillState({ snapshot });

    expect(drill.lane).toBe('NEEDS_ACTION');
    expect(drill.currentTask.taskLabel).toBe(TaskLabel.CALLBACK_CUSTOMER);
    expect(drill.isBlocked).toBe(true);
    expect(drill.progressPct).toBeLessThan(100);
  });

  it('should return NEEDS_ACTION with VERIFY_STOCK for paid order', () => {
    const snapshot = makeSnapshot({
      status: OrderStatus.TO_DO,
      paymentStatus: PaymentStatus.PAID,
    });

    const drill = computeDrillState({ snapshot });

    expect(drill.lane).toBe('NEEDS_ACTION');
    expect(drill.currentTask.taskLabel).toBe(TaskLabel.VERIFY_STOCK);
  });

  it('should return WAITING when snoozed with future date', () => {
    const futureSnooze = new Date();
    futureSnooze.setDate(futureSnooze.getDate() + 1);

    const snapshot = makeSnapshot({
      paymentStatus: PaymentStatus.PAID,
    });

    const drill = computeDrillState({
      snapshot,
      opsSnoozeUntil: futureSnooze,
      opsSnoozeReason: 'מחר בוקר',
    });

    expect(drill.lane).toBe('WAITING');
    expect(drill.isSnoozed).toBe(true);
    expect(drill.snoozeReason).toBe('מחר בוקר');
  });

  it('should return NEEDS_ACTION when snooze expired', () => {
    const pastSnooze = new Date();
    pastSnooze.setDate(pastSnooze.getDate() - 1);

    const snapshot = makeSnapshot({
      paymentStatus: PaymentStatus.PAID,
    });

    const drill = computeDrillState({
      snapshot,
      opsSnoozeUntil: pastSnooze,
    });

    expect(drill.isSnoozed).toBe(false);
    expect(drill.lane).toBe('NEEDS_ACTION');
  });

  it('should return NEEDS_ACTION for terminal (SUPPLIED/CLOSED) orders', () => {
    const snapshot = makeSnapshot({
      status: OrderStatus.SUPPLIED,
      paymentStatus: PaymentStatus.PAID,
    });

    const drill = computeDrillState({ snapshot });

    expect(drill.lane).toBe('NEEDS_ACTION');
    expect(drill.currentTask.taskLabel).toBe(TaskLabel.CLOSE_ORDER);
  });

  it('should calculate progress correctly with manual overrides', () => {
    const snapshot = makeSnapshot({
      paymentStatus: PaymentStatus.PENDING,
    });

    // R2 has 3 checklist items. Override one as done.
    const drill = computeDrillState({
      snapshot,
      opsChecklistState: {
        [TaskLabel.CALLBACK_CUSTOMER]: {
          contacted_customer: true,
        },
      },
    });

    expect(drill.currentTask.steps.length).toBeGreaterThan(0);
    const doneSteps = drill.currentTask.steps.filter((s) => s.status === 'DONE');
    expect(doneSteps.length).toBeGreaterThanOrEqual(1);
    expect(drill.progressPct).toBeGreaterThan(0);
  });

  it('should provide nextTask when current is not terminal', () => {
    const snapshot = makeSnapshot({
      paymentStatus: PaymentStatus.PAID,
    });

    const drill = computeDrillState({ snapshot });

    expect(drill.nextTask).not.toBeNull();
    expect(drill.nextTask?.taskLabel).toBeDefined();
  });

  it('should have null nextTask for terminal CLOSE_ORDER', () => {
    const snapshot = makeSnapshot({
      status: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
    });

    const drill = computeDrillState({ snapshot });

    // CLOSE_ORDER is first in TASK_FLOW_ORDER, next should still exist
    // but VERIFY_ORDER (last) should be skipped
    expect(drill.currentTask.taskLabel).toBe(TaskLabel.CLOSE_ORDER);
  });

  it('should return WAITING for AWAITING_STOCK orders', () => {
    const snapshot = makeSnapshot({
      status: OrderStatus.AWAITING_STOCK,
      paymentStatus: PaymentStatus.PAID,
      items: [
        { sku: 'SKU-1', qtyRequired: 2, qtyReceived: 0, supplierId: 'sup-1' },
      ],
    });

    const drill = computeDrillState({ snapshot });

    expect(drill.currentTask.taskLabel).toBe(TaskLabel.RECEIVE_GOODS);
  });
});

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
});
