import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

// HTML Sanitization
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'div', 'span'],
    ALLOWED_ATTR: ['class'],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input'],
  });
}

// SQL Injection Prevention (additional layer beyond Prisma's built-in protection)
export function sanitizeForDatabase(input: string): string {
  return input
    .replace(/['";\\]/g, '') // Remove potentially dangerous characters
    .replace(/--/g, '') // Remove SQL comment markers
    .replace(/\/\*/g, '') // Remove SQL block comment start
    .replace(/\*\//g, '') // Remove SQL block comment end
    .trim();
}

// XSS Prevention for text content
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

// Phone number sanitization (for Israeli numbers)
export function sanitizePhone(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Handle Israeli phone numbers
  if (digitsOnly.startsWith('972')) {
    // International format: +972XXXXXXXXX -> 0XXXXXXXXX
    return '0' + digitsOnly.substring(3);
  } else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    // Already in correct format
    return digitsOnly;
  } else if (digitsOnly.length === 9) {
    // Missing leading 0
    return '0' + digitsOnly;
  }

  // Return as-is if doesn't match Israeli patterns
  return digitsOnly;
}

// Email sanitization and normalization
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/\+.*@/, '@'); // Remove '+' aliases in email addresses
}

// File path sanitization (prevent path traversal)
export function sanitizeFilePath(path: string): string {
  return path
    .replace(/\.\./g, '') // Remove path traversal attempts
    .replace(/[<>:"|?*]/g, '') // Remove invalid filename characters
    .replace(/^\//g, '') // Remove leading slash
    .trim();
}

// URL sanitization
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }

    return parsed.toString();
  } catch {
    return ''; // Return empty string for invalid URLs
  }
}

// Currency amount sanitization
export function sanitizeCurrency(amount: string | number): number {
  const numStr = typeof amount === 'string' ? amount : amount.toString();
  const sanitized = numStr.replace(/[^\d.-]/g, ''); // Keep only digits, dots, and minus
  const parsed = parseFloat(sanitized);

  // Ensure reasonable currency limits (0 to 1 billion)
  if (isNaN(parsed) || parsed < 0 || parsed > 1000000000) {
    return 0;
  }

  // Round to 2 decimal places
  return Math.round(parsed * 100) / 100;
}

// Enhanced Zod schemas with sanitization
export const sanitizedStringSchema = z.string().transform(sanitizeText);

export const sanitizedHtmlSchema = z.string().transform(sanitizeHtml);

export const sanitizedEmailSchema = z
  .string()
  .email()
  .transform(sanitizeEmail)
  .refine((email) => email.length > 0, 'Invalid email address');

export const sanitizedPhoneSchema = z
  .string()
  .transform(sanitizePhone)
  .refine((phone) => /^0\d{9}$/.test(phone), 'Invalid Israeli phone number');

export const sanitizedUrlSchema = z
  .string()
  .url()
  .transform(sanitizeUrl)
  .refine((url) => url.length > 0, 'Invalid URL');

export const sanitizedCurrencySchema = z
  .union([z.string(), z.number()])
  .transform(sanitizeCurrency)
  .refine((amount) => amount >= 0, 'Amount must be non-negative');

// Address sanitization for geographical data
export function sanitizeAddress(address: string): {
  sanitized: string;
  houseNumber?: string;
  street: string;
  city?: string;
} {
  const cleaned = sanitizeText(address);

  // Attempt to extract house number (Israeli format)
  const houseNumberMatch = cleaned.match(/(\d+)\s*,?\s*(.*)/);

  if (houseNumberMatch) {
    return {
      sanitized: cleaned,
      houseNumber: houseNumberMatch[1],
      street: (houseNumberMatch[2] || '').trim(),
    };
  }

  return {
    sanitized: cleaned,
    street: cleaned,
  };
}

// Order status sanitization
export function sanitizeOrderStatus(status: string): string {
  const validStatuses = [
    'TO_DO',
    'CALL_BACK',
    'PO_CREATED',
    'AWAITING_STOCK',
    'PARTIALLY_SUPPLIED',
    'INSTALL_SCHEDULING',
    'AWAITING_INSTALL',
    'SUPPLIED',
    'CANCELLED',
  ];

  const upperStatus = status.toUpperCase();
  return validStatuses.includes(upperStatus) ? upperStatus : 'TO_DO';
}

// User role sanitization
export function sanitizeUserRole(role: string): string {
  const validRoles = ['ADMIN', 'SALES', 'PURCHASING', 'INSTALLER'];
  const upperRole = role.toUpperCase();
  return validRoles.includes(upperRole) ? upperRole : 'SALES';
}

// Comprehensive input sanitizer for order data
export function sanitizeOrderInput(input: any): any {
  const sanitized: any = {};

  // Required fields
  if (input.number) {
    sanitized.number = parseInt(input.number) || 0;
  }

  if (input.customerName) {
    sanitized.customerName = sanitizeText(input.customerName);
  }

  if (input.totalAmount) {
    sanitized.totalAmount = sanitizeCurrency(input.totalAmount);
  }

  if (input.address) {
    const addressData = sanitizeAddress(input.address);
    sanitized.address = addressData.street;
    if (addressData.houseNumber) {
      sanitized.houseNumber = addressData.houseNumber;
    }
  }

  // Optional fields
  if (input.customerEmail) {
    sanitized.customerEmail = sanitizeEmail(input.customerEmail);
  }

  if (input.customerPhone) {
    sanitized.customerPhone = sanitizePhone(input.customerPhone);
  }

  if (input.city) {
    sanitized.city = sanitizeText(input.city);
  }

  if (input.floor) {
    sanitized.floor = sanitizeText(input.floor);
  }

  if (input.note) {
    sanitized.note = sanitizeText(input.note);
  }

  if (input.status) {
    sanitized.status = sanitizeOrderStatus(input.status);
  }

  return sanitized;
}

// Security headers sanitization
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  Object.entries(headers).forEach(([key, value]) => {
    // Only allow specific headers and sanitize values
    const allowedHeaders = [
      'content-type',
      'authorization',
      'x-api-key',
      'user-agent',
      'accept',
      'accept-language',
      'x-forwarded-for',
      'x-real-ip',
    ];

    if (allowedHeaders.includes(key.toLowerCase())) {
      sanitized[key] = sanitizeText(value);
    }
  });

  return sanitized;
}

// Rate limiting key sanitization
export function sanitizeRateLimitKey(key: string): string {
  return key
    .replace(/[^a-zA-Z0-9:.]/g, '') // Only allow alphanumeric, dots, and colons
    .substring(0, 100) // Limit length
    .toLowerCase();
}

// Validation with sanitization middleware
export function createSanitizedValidator<T>(schema: z.ZodSchema<T>) {
  return (input: unknown): T => {
    // Pre-sanitization for known dangerous patterns
    if (typeof input === 'object' && input !== null) {
      const sanitizedInput = sanitizeObject(input);
      return schema.parse(sanitizedInput);
    }

    return schema.parse(input);
  };
}

// Generic object sanitization
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};

  Object.entries(obj).forEach(([key, value]) => {
    // Sanitize key
    const sanitizedKey = sanitizeText(key);

    // Recursively sanitize value
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[sanitizedKey] = sanitizeObject(value);
    } else {
      sanitized[sanitizedKey] = value;
    }
  });

  return sanitized;
}

// Export comprehensive sanitization function
export function sanitizeInput(input: unknown): unknown {
  return sanitizeObject(input);
}
