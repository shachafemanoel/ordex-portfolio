
/**
 * KPI Calculation Helpers
 *
 * Provides safe arithmetic operations for financial and statistical metrics.
 * Handles division by zero, null/undefined inputs, and formatting.
 */

/**
 * Safely divides two numbers, returning null if denominator is zero or inputs are invalid.
 */
export function safeDivide(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (numerator == null || denominator == null) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Calculates percentage, returning null if denominator is zero.
 * @returns number (e.g. 15.5 for 15.5%) or null
 */
export function percent(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  const result = safeDivide(numerator, denominator);
  if (result === null) return null;
  return result * 100;
}

/**
 * Safely calculates average.
 */
export function safeAverage(sum: number | null | undefined, count: number | null | undefined): number | null {
  return safeDivide(sum, count);
}

/**
 * Calculates percentage change between two values.
 * Returns null if previous value is zero.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
