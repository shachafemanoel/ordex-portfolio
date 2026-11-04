import { describe, it, expect } from 'vitest';
import { schedulePayloadSchema } from '@/lib/orders/scheduleValidation';

describe('schedulePayloadSchema', () => {
  it('accepts valid payload', () => {
    const payload = {
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      installerName: 'טכנאי',
      address: { city: 'תל אביב', street: 'דיזנגוף', number: '10' },
    };
    const result = schedulePayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('fails when address missing parts', () => {
    const payload = {
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      address: { city: '', street: 'דיזנגוף', number: '10' },
    };
    const result = schedulePayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
