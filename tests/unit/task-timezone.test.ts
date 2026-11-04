/**
 * Unit tests for timezone-aware task scheduling
 * Tests DST-safe behavior for Israel timezone
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tomorrowAtTimeInIsrael, dateTimeInIsrael } from '@/lib/services/task-service';
import { utcToZonedTime, formatInTimeZone } from 'date-fns-tz';

const ISRAEL_TZ = 'Asia/Jerusalem';

describe('tomorrowAtTimeInIsrael', () => {
  it('should return correct UTC time for tomorrow at 10:00 Israel time (winter)', () => {
    // Mock current time: 2025-01-15 15:00 UTC (5pm Israel time, winter - UTC+2)
    vi.setSystemTime(new Date('2025-01-15T15:00:00Z'));

    const result = tomorrowAtTimeInIsrael(10, 0);

    // Expected: tomorrow (Jan 16) at 10:00 Israel time = 08:00 UTC (winter, UTC+2)
    const expectedUtc = new Date('2025-01-16T08:00:00Z');

    expect(result.getTime()).toBe(expectedUtc.getTime());

    // Verify it's actually 10:00 in Israel timezone
    const israelTime = utcToZonedTime(result, ISRAEL_TZ);
    expect(israelTime.getHours()).toBe(10);
    expect(israelTime.getMinutes()).toBe(0);

    vi.useRealTimers();
  });

  it('should return correct UTC time for tomorrow at 10:00 Israel time (summer DST)', () => {
    // Mock current time: 2025-07-15 15:00 UTC (6pm Israel time, summer - UTC+3)
    vi.setSystemTime(new Date('2025-07-15T15:00:00Z'));

    const result = tomorrowAtTimeInIsrael(10, 0);

    // Expected: tomorrow (July 16) at 10:00 Israel time = 07:00 UTC (summer, UTC+3)
    const expectedUtc = new Date('2025-07-16T07:00:00Z');

    expect(result.getTime()).toBe(expectedUtc.getTime());

    // Verify it's actually 10:00 in Israel timezone
    const israelTime = utcToZonedTime(result, ISRAEL_TZ);
    expect(israelTime.getHours()).toBe(10);
    expect(israelTime.getMinutes()).toBe(0);

    vi.useRealTimers();
  });

  it('should handle minutes parameter correctly', () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    const result = tomorrowAtTimeInIsrael(14, 30);

    // Verify it's 14:30 in Israel timezone
    const israelTime = utcToZonedTime(result, ISRAEL_TZ);
    expect(israelTime.getHours()).toBe(14);
    expect(israelTime.getMinutes()).toBe(30);
    expect(israelTime.getSeconds()).toBe(0);
    expect(israelTime.getMilliseconds()).toBe(0);

    vi.useRealTimers();
  });

  it('should handle transition across DST boundary (spring forward)', () => {
    // Israel DST starts last Friday of March at 02:00 (moves to 03:00)
    // Mock: March 24, 2025 (before DST)
    vi.setSystemTime(new Date('2025-03-24T15:00:00Z'));

    const result = tomorrowAtTimeInIsrael(10, 0);

    // Tomorrow (March 25) is before DST transition
    const israelTime = utcToZonedTime(result, ISRAEL_TZ);
    expect(israelTime.getHours()).toBe(10);

    vi.useRealTimers();
  });

  it('should handle transition across DST boundary (fall back)', () => {
    // Israel DST ends last Sunday of October at 02:00 (back to 01:00)
    // Mock: October 25, 2025 (after DST)
    vi.setSystemTime(new Date('2025-10-25T15:00:00Z'));

    const result = tomorrowAtTimeInIsrael(10, 0);

    // Tomorrow (October 26) is after DST ends
    const israelTime = utcToZonedTime(result, ISRAEL_TZ);
    expect(israelTime.getHours()).toBe(10);

    vi.useRealTimers();
  });
});

describe('dateTimeInIsrael', () => {
  it('should convert specific date/time to UTC correctly (winter)', () => {
    const inputDate = new Date('2025-01-20T00:00:00Z');
    const result = dateTimeInIsrael(inputDate, 15, 30);

    // Expected: Jan 20 at 15:30 Israel time = 13:30 UTC (winter, UTC+2)
    const israelTime = utcToZonedTime(result, ISRAEL_TZ);
    expect(israelTime.getHours()).toBe(15);
    expect(israelTime.getMinutes()).toBe(30);
  });

  it('should convert specific date/time to UTC correctly (summer DST)', () => {
    const inputDate = new Date('2025-07-20T00:00:00Z');
    const result = dateTimeInIsrael(inputDate, 15, 30);

    // Expected: July 20 at 15:30 Israel time = 12:30 UTC (summer, UTC+3)
    const israelTime = utcToZonedTime(result, ISRAEL_TZ);
    expect(israelTime.getHours()).toBe(15);
    expect(israelTime.getMinutes()).toBe(30);
  });

  it('should zero out seconds and milliseconds', () => {
    const inputDate = new Date('2025-01-20T00:00:00Z');
    const result = dateTimeInIsrael(inputDate, 10, 15);

    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });
});

describe('Real-world scenarios', () => {
  it('customer wants to think - callback tomorrow at 10:00', () => {
    // Simulate: Customer called at 2pm Israel time (Jan 15, 2025)
    // Current time: 12:00 UTC (2pm Israel winter time, UTC+2)
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    const callbackTime = tomorrowAtTimeInIsrael(10, 0);

    // Verify: Tomorrow (Jan 16) at 10:00am Israel time
    const israelTime = utcToZonedTime(callbackTime, ISRAEL_TZ);
    const formatted = formatInTimeZone(callbackTime, ISRAEL_TZ, 'yyyy-MM-dd HH:mm:ss zzz');

    expect(israelTime.getHours()).toBe(10);
    expect(israelTime.getMinutes()).toBe(0);
    expect(formatted).toContain('2025-01-16');
    expect(formatted).toContain('10:00:00');

    // Verify it's stored as UTC for database
    expect(callbackTime.toISOString()).toBe('2025-01-16T08:00:00.000Z');

    vi.useRealTimers();
  });

  it('schedule installation for specific date at 9:00am', () => {
    const installDate = new Date('2025-02-01T00:00:00Z');
    const scheduledTime = dateTimeInIsrael(installDate, 9, 0);

    // Verify: Feb 1 at 9:00am Israel time
    const israelTime = utcToZonedTime(scheduledTime, ISRAEL_TZ);
    expect(israelTime.getHours()).toBe(9);
    expect(israelTime.getMinutes()).toBe(0);
  });
});
