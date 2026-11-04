import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_LOCALE = 'he-IL';
const DEFAULT_TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || 'Asia/Jerusalem';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: DEFAULT_TIME_ZONE,
};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTIONS,
  hour: '2-digit',
  minute: '2-digit',
};

// Pre-calculate keys for default options to avoid JSON.stringify overhead
const DATE_OPTIONS_KEY = JSON.stringify(DATE_OPTIONS);
const DATE_TIME_OPTIONS_KEY = JSON.stringify(DATE_TIME_OPTIONS);
const EMPTY_NUMBER_OPTIONS_KEY = `he-IL:${JSON.stringify({})}`;
const DEFAULT_CURRENCY_OPTIONS: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'ILS',
};
const DEFAULT_CURRENCY_KEY = `he-IL:${JSON.stringify(DEFAULT_CURRENCY_OPTIONS)}`;

// Cache for Intl.DateTimeFormat
const dateTimeFormattersCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(options: Intl.DateTimeFormatOptions, key?: string): Intl.DateTimeFormat {
  const cacheKey = key || JSON.stringify(options);
  let formatter = dateTimeFormattersCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, options);
    dateTimeFormattersCache.set(cacheKey, formatter);
  }
  return formatter;
}

export type SafeDateInput = string | Date | number | null | undefined;

export function toSafeDate(date: SafeDateInput): Date | null {
  if (date === null || date === undefined) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatDate(date: string | Date | number | null | undefined, options?: Intl.DateTimeFormatOptions) {
  const safeDate = toSafeDate(date);
  if (!safeDate) return '-';

  if (!options) {
    return getDateTimeFormatter(DATE_OPTIONS, DATE_OPTIONS_KEY).format(safeDate);
  }
  const mergedOptions = { ...DATE_OPTIONS, ...options };
  return getDateTimeFormatter(mergedOptions).format(safeDate);
}

export function formatDateTime(date: string | Date | number | null | undefined, options?: Intl.DateTimeFormatOptions) {
  const safeDate = toSafeDate(date);
  if (!safeDate) return '-';

  if (!options) {
    return getDateTimeFormatter(DATE_TIME_OPTIONS, DATE_TIME_OPTIONS_KEY).format(safeDate);
  }

  // If dateStyle or timeStyle are present, we cannot merge with default component options (year, month, etc.)
  // as it causes "Invalid option" error in Intl.DateTimeFormat
  if (options.dateStyle || options.timeStyle) {
    const safeOptions = { timeZone: DEFAULT_TIME_ZONE, ...options };
    return getDateTimeFormatter(safeOptions).format(safeDate);
  }

  const mergedOptions = { ...DATE_TIME_OPTIONS, ...options };
  return getDateTimeFormatter(mergedOptions).format(safeDate);
}

// Cache for Intl.NumberFormat
const numberFormattersCache = new Map<string, Intl.NumberFormat>();

export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions, key?: string): Intl.NumberFormat {
  const cacheKey = key || `${locale}:${JSON.stringify(options)}`;
  let formatter = numberFormattersCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormattersCache.set(cacheKey, formatter);
  }
  return formatter;
}

export function formatNumber(amount: number, options?: Intl.NumberFormatOptions) {
  if (!options) {
    return getNumberFormatter('he-IL', {}, EMPTY_NUMBER_OPTIONS_KEY).format(amount);
  }
  return getNumberFormatter('he-IL', options).format(amount);
}

export function formatCurrency(amount: number, options?: Intl.NumberFormatOptions) {
  if (!options) {
    return getNumberFormatter('he-IL', DEFAULT_CURRENCY_OPTIONS, DEFAULT_CURRENCY_KEY).format(amount);
  }
  return getNumberFormatter('he-IL', { ...DEFAULT_CURRENCY_OPTIONS, ...options }).format(amount);
}

/**
 * Format price in cents as currency (ILS)
 * Automatically converts cents to shekels before formatting
 *
 * @param cents - Price in cents (e.g., 10000 = 100.00 ILS)
 * @param options - Optional Intl.NumberFormatOptions
 * @returns Formatted currency string (e.g., "₪100.00")
 *
 * @example
 * formatCurrencyCents(10000) // "₪100.00"
 * formatCurrencyCents(100050) // "₪1,000.50"
 * formatCurrencyCents(null) // "—"
 */
export function formatCurrencyCents(cents: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (cents === null || cents === undefined) return '—';
  const shekels = cents / 100;
  return formatCurrency(shekels, options);
}

export function getBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}

export function createUrl(path: string | URL) {
  if (path instanceof URL) {
    return path;
  }

  if (/^https?:\/\//i.test(path)) {
    return new URL(path);
  }

  return new URL(path, getBaseUrl());
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  TO_DO: 'bg-blue-100 text-blue-800',
  CALL_BACK: 'bg-yellow-100 text-yellow-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PO_CREATED: 'bg-purple-100 text-purple-800',
  AWAITING_STOCK: 'bg-orange-100 text-orange-800',
  PARTIALLY_SUPPLIED: 'bg-amber-100 text-amber-800',
  READY_FOR_INSTALL: 'bg-orange-100 text-orange-800',
  INSTALL_SCHEDULING: 'bg-orange-100 text-orange-800',
  AWAITING_INSTALL: 'bg-cyan-100 text-cyan-800',
  SCHEDULED: 'bg-cyan-100 text-cyan-800',
  COMPLETED: 'bg-green-100 text-green-800',
  INSTALLED: 'bg-green-100 text-green-800',
  SUPPLIED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function getStatusColor(status: string) {
  return STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
}

// Generate a CUID-like ID
export function createId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${randomStr}`;
}
