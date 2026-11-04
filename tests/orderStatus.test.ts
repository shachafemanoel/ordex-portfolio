import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@prisma/client';
import { evaluateReceivingProgress } from '@/lib/receiving-evaluator';
import { normalizeOrderStatus, ORDER_STATUS_FLOW } from '@/lib/orderStatus';
import { validateTransition } from '@/lib/status-machine';

describe('order status helpers', () => {
  it('normalizes external aliases into valid OrderStatus values', () => {
    expect(normalizeOrderStatus('CALLBACK_CUSTOMER')).toBe('CALL_BACK');
    // Valid Prisma statuses are returned as-is
    expect(normalizeOrderStatus('INSTALL_SCHEDULING')).toBe('INSTALL_SCHEDULING');
    expect(normalizeOrderStatus('SUPPLIED')).toBe('SUPPLIED');
    // PO_CREATED is a valid Prisma status
    expect(Object.values(OrderStatus)).toContain(normalizeOrderStatus('PO_CREATED'));
  });

  it('validates the primary lifecycle path', () => {
    // Core flow transitions
    const corePath: OrderStatus[] = ['RECEIVED', 'PROCESSING', 'READY', 'IN_TRANSIT', 'INSTALLATION', 'COMPLETED'];
    corePath.slice(0, -1).forEach((from, index) => {
      const to = corePath[index + 1];
      expect(validateTransition(from, to).isValid).toBe(true);
    });

    // Legacy path transitions
    const path: OrderStatus[] = ['PO_CREATED', 'AWAITING_STOCK', 'PARTIALLY_SUPPLIED'];
    path.slice(0, -1).forEach((from, index) => {
      const to = path[index + 1];
      expect(validateTransition(from, to).isValid).toBe(true);
    });

    expect(validateTransition('COMPLETED', 'TO_DO').isValid).toBe(false);
  });
});

describe('receiving progress evaluation', () => {
  const baseItems = [
    { qty: 2, receivedQuantity: 0, received: false },
    { qty: 1, receivedQuantity: 0, received: false },
  ];

  it('keeps status when nothing is received', () => {
    const result = evaluateReceivingProgress(baseItems, 'AWAITING_STOCK');
    expect(result.newStatus).toBeUndefined();
  });

  it('moves to partially supplied when some items arrive', () => {
    const items = [
      { qty: 2, receivedQuantity: 1, received: false },
      { qty: 1, receivedQuantity: 0, received: false },
    ];
    const result = evaluateReceivingProgress(items, 'AWAITING_STOCK');
    expect(result.newStatus).toBe('PARTIALLY_SUPPLIED');
  });

  it('moves to ready for install when all items are received', () => {
    const items = [
      { qty: 2, receivedQuantity: 2, received: true },
      { qty: 1, receivedQuantity: 1, received: true },
    ];
    const result = evaluateReceivingProgress(items, 'PARTIALLY_SUPPLIED');
    expect(result.newStatus).toBe('READY_FOR_INSTALL');
  });

  it('supports an integration-style receiving + scheduling flow', () => {
    const partial = [
      { qty: 1, receivedQuantity: 1, received: true },
      { qty: 1, receivedQuantity: 0, received: false },
    ];
    const partialResult = evaluateReceivingProgress(partial, 'AWAITING_STOCK');
    expect(partialResult.newStatus).toBe('PARTIALLY_SUPPLIED');

    const completed = [
      { qty: 1, receivedQuantity: 1, received: true },
      { qty: 1, receivedQuantity: 1, received: true },
    ];
    const readyResult = evaluateReceivingProgress(completed, partialResult.newStatus ?? 'PARTIALLY_SUPPLIED');
    expect(readyResult.newStatus).toBe('READY_FOR_INSTALL');

    const scheduleTransition = validateTransition('READY_FOR_INSTALL', 'SCHEDULED');
    expect(scheduleTransition.isValid).toBe(true);
  });

  it('does not downgrade scheduled orders when fully received', () => {
    const completed = [
      { qty: 1, receivedQuantity: 1, received: true },
      { qty: 2, receivedQuantity: 2, received: true },
    ];

    const result = evaluateReceivingProgress(completed, 'SCHEDULED');

    expect(result.newStatus).toBeUndefined();
    expect(result.triggeredActions).toContain('ALL_ITEMS_RECEIVED');
  });
});
