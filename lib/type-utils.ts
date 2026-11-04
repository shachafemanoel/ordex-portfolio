/**
 * Type Safety Utilities
 *
 * Global utility functions to handle common type conversion issues
 * and prevent build crashes from type mismatches.
 */

/**
 * Safely converts any object to Record<string, unknown>
 * Useful for filter objects, metadata, etc.
 */
export function toRecord<T = unknown>(value: any): Record<string, T> {
  if (!value || typeof value !== 'object') {
    return {} as Record<string, T>;
  }
  return value as Record<string, T>;
}

/**
 * Safely parses a number, returning fallback if invalid
 */
export function toNumber(value: any, fallback: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely parses an integer, returning fallback if invalid
 */
export function toInt(value: any, fallback: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.floor(value);
  }
  const parsed = parseInt(String(value), 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely converts to string, handling null/undefined
 */
export function toString(value: any, fallback: string = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

/**
 * Safely ensures a value is an array
 */
export function toArray<T>(value: any): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

/**
 * Type guard to check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Safely access nested properties with fallback
 */
export function get<T>(obj: any, path: string, fallback?: T): T | undefined {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result === null || result === undefined) {
      return fallback;
    }
    result = result[key];
  }

  return result ?? fallback;
}
