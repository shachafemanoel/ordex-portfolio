import { describe, it, expect } from 'vitest';
import { schedulePayloadSchema } from '@/lib/orders/scheduleValidation';
import { ScheduleMode } from '@prisma/client';

describe('schedulePayloadSchema', () => {
  it('should validate valid EXACT_TIME payload', () => {
    const result = schedulePayloadSchema.safeParse({
      scheduledAt: new Date().toISOString(),
      scheduleMode: ScheduleMode.EXACT_TIME,
      durationMinutes: 60,
    });
    expect(result.success).toBe(true);
  });

  it('should validate valid TIME_WINDOW payload', () => {
    const result = schedulePayloadSchema.safeParse({
      scheduledAt: new Date().toISOString(),
      scheduleMode: ScheduleMode.TIME_WINDOW,
      timeWindowStart: '09:00',
      timeWindowEnd: '13:00',
    });
    expect(result.success).toBe(true);
  });

  it('should fail TIME_WINDOW payload missing window times', () => {
    const result = schedulePayloadSchema.safeParse({
      scheduledAt: new Date().toISOString(),
      scheduleMode: ScheduleMode.TIME_WINDOW,
    });
    expect(result.success).toBe(false);
  });

  it('should fail invalid time format', () => {
    const result = schedulePayloadSchema.safeParse({
      scheduledAt: new Date().toISOString(),
      scheduleMode: ScheduleMode.TIME_WINDOW,
      timeWindowStart: '25:00',
      timeWindowEnd: '13:00',
    });
    expect(result.success).toBe(false);
  });
});
