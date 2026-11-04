
import { describe, it, expect } from 'vitest';
import { formatPrice } from '@/lib/utils/price';

describe('lib/utils/price', () => {
  describe('formatPrice', () => {
    it('formats ILS correctly (shekels input? No, cents input!)', () => {
       // wait, formatPrice takes CENTS
       // 123456 cents = 1234.56 ILS
       expect(formatPrice(123456)).toBe('₪1,234.56');
    });

    it('formats ILS correctly with zero cents', () => {
       // 10000 cents = 100.00 ILS
       expect(formatPrice(10000)).toBe('₪100.00');
    });

    it('formats ILS correctly with other currency param', () => {
       // 123456 cents = 1234.56 USD
       expect(formatPrice(123456, 'USD')).toBe('1,234.56 USD');
    });

     it('formats ILS correctly with other currency param and locale', () => {
       // 123456 cents = 1,234.56 USD in en-US
       expect(formatPrice(123456, 'USD', 'en-US')).toBe('1,234.56 USD');
    });

    it('respects locale for ILS', () => {
        // de-DE uses comma for decimal separator
        // 123456 cents = 1234.56 ILS
        // format: 1.234,56
        expect(formatPrice(123456, 'ILS', 'de-DE')).toBe('₪1.234,56');
    });

    it('handles null/undefined', () => {
      expect(formatPrice(null)).toBe('-');
      expect(formatPrice(undefined)).toBe('-');
    });
  });
});
