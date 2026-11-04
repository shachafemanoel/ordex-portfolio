
import { describe, it, expect } from 'vitest';
import { safeDivide, percent, safeAverage, percentChange } from '@/lib/utils/kpi';

describe('KPI Utils', () => {
  describe('safeDivide', () => {
    it('returns result when valid inputs', () => {
      expect(safeDivide(10, 2)).toBe(5);
      expect(safeDivide(0, 5)).toBe(0);
    });

    it('returns null when denominator is 0', () => {
      expect(safeDivide(10, 0)).toBeNull();
    });

    it('returns null when inputs are null/undefined', () => {
      expect(safeDivide(10, null)).toBeNull();
      expect(safeDivide(null, 5)).toBeNull();
      expect(safeDivide(undefined, 5)).toBeNull();
    });
  });

  describe('percent', () => {
    it('returns percentage when valid inputs', () => {
      expect(percent(1, 2)).toBe(50);
      expect(percent(0.1, 1)).toBe(10);
      expect(percent(0, 10)).toBe(0);
    });

    it('returns null when denominator is 0', () => {
      expect(percent(10, 0)).toBeNull();
    });
  });

  describe('safeAverage', () => {
    it('returns average when valid inputs', () => {
      expect(safeAverage(100, 10)).toBe(10);
    });

    it('returns null when count is 0', () => {
      expect(safeAverage(100, 0)).toBeNull();
    });
  });

  describe('percentChange', () => {
    it('returns positive change', () => {
      expect(percentChange(120, 100)).toBe(20);
    });

    it('returns negative change', () => {
      expect(percentChange(80, 100)).toBe(-20);
    });

    it('returns 0 change', () => {
      expect(percentChange(100, 100)).toBe(0);
    });

    it('returns null if previous is 0', () => {
      expect(percentChange(100, 0)).toBeNull();
    });
  });
});
