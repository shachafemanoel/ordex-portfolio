import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@prisma/client';
import {
  ALLOWED_STATUSES,
  getAllowedStatuses,
  getValidTransitions,
  getStatusDescription,
  getStatusDisplayName,
  getStatusProgress,
  isTerminalStatus,
  validateTransition,
} from '@/lib/status-machine';
import { ORDER_STATUS_FLOW } from '@/lib/orderStatus';

const CANONICAL_PATH: OrderStatus[] = [
  'RECEIVED',
  'PROCESSING',
  'READY',
  'IN_TRANSIT',
  'INSTALLATION',
  'COMPLETED',
];

describe('Status machine', () => {
  it('exposes the canonical lifecycle in order', () => {
    expect(ALLOWED_STATUSES).toEqual(ORDER_STATUS_FLOW);
    expect(getAllowedStatuses()).toEqual(ORDER_STATUS_FLOW);
  });

  it('allows the happy path transitions', () => {
    CANONICAL_PATH.slice(0, -1).forEach((status, idx) => {
      const target = CANONICAL_PATH[idx + 1];
      const result = validateTransition(status, target);
      expect(result.isValid).toBe(true);
      expect(getValidTransitions(status)).toContain(target);
    });
  });

  it('rejects backward transitions from completed states', () => {
    const invalid = validateTransition('COMPLETED', 'TO_DO');
    expect(invalid.isValid).toBe(false);
    expect(invalid.allowedTargets).toEqual([]);
  });

  it('computes progress for key milestones', () => {
    expect(getStatusProgress('TO_DO')).toBeGreaterThan(0);
    expect(getStatusProgress('PARTIALLY_SUPPLIED')).toBeGreaterThan(getStatusProgress('AWAITING_STOCK'));
    expect(getStatusProgress('COMPLETED')).toBe(100);
    expect(getStatusProgress('CANCELLED')).toBe(0);
  });

  it('provides display names and descriptions', () => {
    expect(getStatusDisplayName('CALL_BACK')).toBeTruthy();
    expect(getStatusDescription('READY_FOR_INSTALL')).toContain('התקנה');
  });

  it('marks terminal statuses correctly', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true);
    expect(isTerminalStatus('CANCELLED')).toBe(true);
    expect(isTerminalStatus('AWAITING_STOCK')).toBe(false);
  });
});
