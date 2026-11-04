import { failureState, RETRY_DELAYS_MS } from '@/lib/integrations/woocommerce/jobs';
import { StoreError } from '@/lib/integrations/woocommerce/store-client';
import { cents, transformOrder } from '@/lib/integrations/woocommerce/transform';
import { describe, expect, it } from 'vitest';
import { wooOrder } from '../../support/wooMockStore';

describe('store commerce, without operational side effects', () => {
  it('keeps exact source money and separates house number without making one up', () => {
    expect(cents('123.45')).toBe(12345);
    const o = transformOrder(wooOrder(1));
    expect(o.subTotalCents).toBe(45000);
    expect(o.shipping).toMatchObject({ city: 'חיפה', street: 'הרצל', number: '5' });
    expect(
      transformOrder(wooOrder(1, { shipping: { city: 'חיפה', address_1: 'הרצל' } })).shipping.number
    ).toBe('');
  });
  it.each(['1.234', '-1', 'NaN', '', '1e3', '99999999999'])(
    'rejects invalid or unsupported money %s',
    (amount) => {
      expect(() => cents(amount)).toThrow('INVALID_AMOUNT');
    }
  );
  it('rejects inconsistent totals and absent data', () => {
    expect(() => transformOrder(wooOrder(1, { total: '1.00' }))).toThrow('INCONSISTENT_TOTALS');
    expect(() => transformOrder(wooOrder(1, { currency: undefined }))).toThrow(
      'INVALID_ORDER_DATA'
    );
    expect(() =>
      transformOrder(wooOrder(1, { billing: { address_1: '', city: '', phone: '' } }))
    ).toThrow();
  });
  it('requires explicit store payment evidence; processing alone is unpaid', () => {
    expect(transformOrder(wooOrder(1)).paidAmountCents).toBe(0);
    expect(
      transformOrder(wooOrder(1, { date_paid_gmt: '2026-10-29T08:00:00' })).paidAmountCents
    ).toBe(45000);
  });
  it.each(['cancelled', 'refunded', 'custom-status'])(
    'flags %s for review without mapping operational status',
    (status) => {
      const o = transformOrder(wooOrder(1, { status, date_paid_gmt: '2026-10-29T08:00:00' }));
      expect(o.review).toBeTruthy();
      expect(o.paymentStatus).toBe('PENDING');
      expect(o).not.toHaveProperty('status');
    }
  );
});

describe('bounded retry policy', () => {
  it('retries temporary failures four times and ends after attempt five', () => {
    expect(RETRY_DELAYS_MS).toEqual([60000, 300000, 900000, 3600000]);
    for (let i = 1; i <= 4; i++)
      expect(failureState(new StoreError('UNREACHABLE'), i)).toMatchObject({
        state: 'PENDING',
        delay: RETRY_DELAYS_MS[i - 1],
      });
    expect(failureState(new Error(), 5).state).toBe('FAILED');
  });
  it.each(['UNAUTHORIZED', 'FORBIDDEN', 'BAD_RESPONSE'] as const)(
    'does not automatically retry %s',
    (code) => {
      expect(failureState(new StoreError(code), 1).state).toBe('NEEDS_ATTENTION');
    }
  );
});
