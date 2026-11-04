/**
 * Money Value Object
 *
 * Represents a monetary amount with currency.
 * Immutable value object following DDD principles.
 *
 * @module lib/domain/value-objects/Money
 */

/**
 * Supported currencies
 */
export type Currency = 'ILS' | 'USD' | 'EUR';

/**
 * Money Value Object
 *
 * All amounts are stored in cents/agorot to avoid floating point precision issues
 */
export class Money {
  // Cache for Intl.NumberFormat instances to improve performance
  private static readonly _formatters = new Map<string, Intl.NumberFormat>();

  private constructor(
    private readonly _amountCents: number,
    private readonly _currency: Currency
  ) {
    if (_amountCents < 0) {
      throw new Error('Money amount cannot be negative');
    }

    if (!Number.isInteger(_amountCents)) {
      throw new Error('Money amount must be an integer (cents)');
    }
  }

  /**
   * Create Money from cents
   */
  static fromCents(amountCents: number, currency: Currency = 'ILS'): Money {
    return new Money(amountCents, currency);
  }

  /**
   * Create Money from decimal amount
   */
  static fromAmount(amount: number, currency: Currency = 'ILS'): Money {
    const amountCents = Math.round(amount * 100);
    return new Money(amountCents, currency);
  }

  /**
   * Create zero amount
   */
  static zero(currency: Currency = 'ILS'): Money {
    return new Money(0, currency);
  }

  /**
   * Get amount in cents
   */
  get amountCents(): number {
    return this._amountCents;
  }

  /**
   * Get amount as decimal
   */
  get amount(): number {
    return this._amountCents / 100;
  }

  /**
   * Get currency
   */
  get currency(): Currency {
    return this._currency;
  }

  /**
   * Check if zero
   */
  isZero(): boolean {
    return this._amountCents === 0;
  }

  /**
   * Check if positive
   */
  isPositive(): boolean {
    return this._amountCents > 0;
  }

  /**
   * Add another Money amount
   */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amountCents + other._amountCents, this._currency);
  }

  /**
   * Subtract another Money amount
   */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this._amountCents - other._amountCents;

    if (result < 0) {
      throw new Error('Cannot subtract to negative amount');
    }

    return new Money(result, this._currency);
  }

  /**
   * Multiply by a factor
   */
  multiply(factor: number): Money {
    if (factor < 0) {
      throw new Error('Cannot multiply by negative factor');
    }

    return new Money(Math.round(this._amountCents * factor), this._currency);
  }

  /**
   * Divide by a divisor
   */
  divide(divisor: number): Money {
    if (divisor <= 0) {
      throw new Error('Cannot divide by zero or negative number');
    }

    return new Money(Math.round(this._amountCents / divisor), this._currency);
  }

  /**
   * Compare with another Money
   */
  equals(other: Money): boolean {
    return (
      this._amountCents === other._amountCents &&
      this._currency === other._currency
    );
  }

  /**
   * Check if greater than another Money
   */
  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amountCents > other._amountCents;
  }

  /**
   * Check if less than another Money
   */
  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amountCents < other._amountCents;
  }

  /**
   * Check if greater than or equal to another Money
   */
  greaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amountCents >= other._amountCents;
  }

  /**
   * Check if less than or equal to another Money
   */
  lessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amountCents <= other._amountCents;
  }

  /**
   * Format as string
   */
  format(): string {
    const key = this._currency;
    let formatter = Money._formatters.get(key);

    if (!formatter) {
      formatter = new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: this._currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      Money._formatters.set(key, formatter);
    }

    return formatter.format(this.amount);
  }

  /**
   * Convert to JSON
   */
  toJSON(): { amountCents: number; currency: Currency } {
    return {
      amountCents: this._amountCents,
      currency: this._currency,
    };
  }

  /**
   * Convert to string
   */
  toString(): string {
    return this.format();
  }

  /**
   * Assert same currency for operations
   */
  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(
        `Currency mismatch: ${this._currency} vs ${other._currency}`
      );
    }
  }
}
