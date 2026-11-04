import { describe, expect, it } from 'vitest';

import { normalizeToCanonicalStatus } from '@/lib/orderStatus';

describe('normalizeToCanonicalStatus', () => {
  it('maps legacy status strings into canonical set', () => {
    expect(normalizeToCanonicalStatus('NEW')).toBe('TO_DO');
    expect(normalizeToCanonicalStatus('WAITING_GOODS')).toBe('AWAITING_STOCK');
  });

  it('returns a safe default for unknown inputs', () => {
    expect(normalizeToCanonicalStatus('totally_unknown')).toBe('DRAFT');
    expect(normalizeToCanonicalStatus(undefined)).toBe('DRAFT');
  });
});
