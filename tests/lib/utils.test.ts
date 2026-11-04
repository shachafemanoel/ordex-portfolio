import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';

describe('lib/utils', () => {
  describe('formatDate', () => {
    it('formats date correctly', () => {
      // 2023-01-01
      const date = new Date('2023-01-01T12:00:00Z'); // Use UTC to be deterministic
      const formatted = formatDate(date);
      // The utility uses 'Asia/Jerusalem' by default (UTC+2 in Jan).
      // So 12:00 UTC -> 14:00 Local. Date remains 01.01.2023.
      expect(formatted).toMatch(/01[./]01[./]2023/);
    });

    it('handles options override', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      const formatted = formatDate(date, { month: 'long' });
      // In he-IL, January is "ינואר"
      expect(formatted).toMatch(/ינואר/);
    });
  });

  describe('formatDateTime', () => {
    it('formats date and time correctly', () => {
      const date = new Date('2023-01-01T12:30:00Z');
      const formatted = formatDateTime(date);
      // The utility uses 'Asia/Jerusalem' by default.
      // 12:30 UTC + 2 hours = 14:30.
      expect(formatted).toMatch(/01[./]01[./]2023/);
      expect(formatted).toMatch(/14:30/);
    });
  });

  describe('formatCurrency', () => {
    it('formats currency correctly', () => {
      const amount = 1234.5;
      const formatted = formatCurrency(amount);
      // ₪1,234.50
      expect(formatted).toContain('1,234.5');
    });
  });
});
