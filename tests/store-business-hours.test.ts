import { describe, expect, it } from 'vitest';

import {
  getBusinessDayDurationMinutes,
  getBusinessHoursLabel,
  isBusinessTimeRangeWithinHours,
  resolveScheduleTimeRange,
} from '@/lib/store-business-hours';

describe('store business hours', () => {
  it('computes daily business capacity in minutes', () => {
    expect(
      getBusinessDayDurationMinutes({
        businessDayStartTime: '09:00',
        businessDayEndTime: '18:00',
      })
    ).toBe(540);
  });

  it('detects whether a requested slot fits the business day', () => {
    const settings = {
      businessDayStartTime: '09:00',
      businessDayEndTime: '18:00',
    };

    expect(isBusinessTimeRangeWithinHours('09:00', '12:00', settings)).toBe(true);
    expect(isBusinessTimeRangeWithinHours('08:30', '12:00', settings)).toBe(false);
    expect(isBusinessTimeRangeWithinHours('16:00', '19:00', settings)).toBe(false);
    expect(getBusinessHoursLabel(settings)).toBe('09:00-18:00');
  });

  it('resolves schedule ranges from explicit time windows', () => {
    const range = resolveScheduleTimeRange({
      scheduledAt: new Date('2026-03-24T07:00:00.000Z'),
      timeWindowStart: '09:00',
      timeWindowEnd: '12:00',
      timezone: 'Asia/Jerusalem',
    });

    expect(range.dateKey).toBe('2026-03-24');
    expect(range.startTime).toBe('09:00');
    expect(range.endTime).toBe('12:00');
  });
});
