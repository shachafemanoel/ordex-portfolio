/**
 * Price Utilities
 *
 * CRITICAL: All prices in the system are stored in CENTS (smallest currency unit).
 * Example: 100 ILS = 10000 cents
 *
 * This module provides utilities to safely convert between display format (ILS) and storage format (cents).
 */

import { getNumberFormatter } from '@/lib/utils';

/**
 * Convert price from shekels to cents
 * @param shekels - Price in shekels (e.g., 100.50)
 * @returns Price in cents (e.g., 10050)
 */
export function shekelsToCents(shekels: number): number {
  if (!Number.isFinite(shekels) || shekels < 0) {
    throw new Error(`Invalid price in shekels: ${shekels}`);
  }
  return Math.round(shekels * 100);
}

/**
 * Convert price from cents to shekels
 * @param cents - Price in cents (e.g., 10050)
 * @returns Price in shekels (e.g., 100.50)
 */
export function centsToShekels(cents: number): number {
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error(`Invalid price in cents: ${cents}`);
  }
  return cents / 100;
}

/**
 * Format price in cents for display
 * @param cents - Price in cents
 * @param currency - Currency code (default: ILS)
 * @param locale - Locale for formatting (default: he-IL)
 * @returns Formatted price string (e.g., "₪100.50")
 */
const PRICE_OPTS: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export function formatPrice(
  cents: number | null | undefined,
  currency: string = 'ILS',
  locale: string = 'he-IL'
): string {
  if (cents === null || cents === undefined) {
    return '-';
  }

  const shekels = centsToShekels(cents);

  if (currency === 'ILS') {
    return `₪${getNumberFormatter(locale, PRICE_OPTS).format(shekels)}`;
  }

  return `${getNumberFormatter(locale, PRICE_OPTS).format(shekels)} ${currency}`;
}

/**
 * Parse user input string to cents
 * Handles various formats: "100", "100.50", "₪100", etc.
 * @param input - User input string
 * @returns Price in cents
 */
export function parseUserInputToCents(input: string): number {
  // Remove currency symbols and whitespace
  const cleaned = input.replace(/[₪$€£,\s]/g, '');

  // Parse as float
  const parsed = parseFloat(cleaned);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid price input: ${input}`);
  }

  return shekelsToCents(parsed);
}

/**
 * Validate that a number is a valid price in cents
 * @param value - Value to validate
 * @returns true if valid, throws error otherwise
 */
export function validatePriceCents(value: unknown): value is number {
  if (typeof value !== 'number') {
    throw new Error(`Price must be a number, got ${typeof value}`);
  }

  if (!Number.isFinite(value)) {
    throw new Error(`Price must be a finite number, got ${value}`);
  }

  if (value < 0) {
    throw new Error(`Price cannot be negative, got ${value}`);
  }

  if (!Number.isInteger(value)) {
    throw new Error(`Price in cents must be an integer, got ${value}`);
  }

  return true;
}
