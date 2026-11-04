import {
  buildDeliveryAttentionWhere,
  buildRolledDeliveryTime,
} from '@/lib/orders/staleDeliveryMonitor';
import { describe, expect, it } from 'vitest';

describe('staleDeliveryMonitor', () => {
  it('rolls a missed delivery into today without leaving it in the future', () => {
    const now = new Date('2026-03-28T10:30:00.000Z');
    const previousScheduledAt = new Date('2026-03-27T18:00:00.000Z');

    const rolled = buildRolledDeliveryTime(previousScheduledAt, now);

    expect(rolled.toISOString()).toBe(now.toISOString());
  });

  it('keeps the original time when rolling into today if it is already overdue', () => {
    const now = new Date('2026-03-28T17:00:00.000Z');
    const previousScheduledAt = new Date('2026-03-27T09:15:00.000Z');

    const rolled = buildRolledDeliveryTime(previousScheduledAt, now);

    expect(rolled.toISOString()).toBe('2026-03-28T09:15:00.000Z');
  });

  it('builds an attention filter for active scheduled deliveries up to now', () => {
    const now = new Date('2026-03-28T12:00:00.000Z');

    expect(buildDeliveryAttentionWhere(now)).toEqual({
      deletedAt: null,
      completedAt: null,
      status: {
        in: [
          'READY',
          'READY_FOR_INSTALL',
          'INSTALL_SCHEDULING',
          'AWAITING_INSTALL',
          'SCHEDULED',
          'IN_TRANSIT',
          'INSTALLATION',
        ],
      },
      scheduledAt: { not: null, lte: now },
      OR: [{ opsSnoozeUntil: null }, { opsSnoozeUntil: { lte: now } }],
    });
  });
});
