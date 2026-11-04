/**
 * Comprehensive Input Sanitization and Validation System
 * Protects against XSS, SQL injection, and other input-based attacks
 */

import { z } from 'zod';
import { logger } from '@/lib/enhanced-logger';

export interface SanitizationOptions {
  allowHtml?: boolean;
  allowedTags?: string[];
  maxLength?: number;
  trimWhitespace?: boolean;
  normalizeUnicode?: boolean;
  preventXSS?: boolean;
}

export interface ValidationContext {
  field: string;
  value: any;
  correlationId?: string;
  userId?: string;
  ip?: string;
}

export interface SanitizationResult {
  value: string;
  sanitized: boolean;
  removedElements: string[];
  warnings: string[];
}

export class InputSanitizer {
  private readonly xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
    /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi, // Event handlers
    /data:text\/html/gi,
    /data:application\/javascript/gi,
  ];

  private readonly sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(UNION\s+SELECT)/gi,
    /(OR\s+1\s*=\s*1)/gi,
    /(AND\s+1\s*=\s*1)/gi,
    /('|\")[^'\"]*('|\")(\s*(OR|AND)\s*('|\")[^'\"]*('|\"))+/gi,
  ];

  private readonly defaultAllowedTags = [
    'p', 'br', 'strong', 'em', 'u', 'i', 'b',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre'
  ];

  /**
   * Sanitize a string input
   */
  sanitizeString(
    input: string,
    options: SanitizationOptions = {}
  ): SanitizationResult {
    let value = input;
    const removedElements: string[] = [];
    const warnings: string[] = [];
    let sanitized = false;

    // Normalize unicode if requested
    if (options.normalizeUnicode !== false) {
      const normalized = value.normalize('NFC');
      if (normalized !== value) {
        value = normalized;
        sanitized = true;
      }
    }

    // Trim whitespace if requested (default: true)
    if (options.trimWhitespace !== false) {
      const trimmed = value.trim();
      if (trimmed !== value) {
        value = trimmed;
        sanitized = true;
      }
    }

    // Check length limits
    if (options.maxLength && value.length > options.maxLength) {
      value = value.substring(0, options.maxLength);
      sanitized = true;
      warnings.push(`Input truncated to ${options.maxLength} characters`);
    }

    // XSS Prevention
    if (options.preventXSS !== false) {
      for (const pattern of this.xssPatterns) {
        const matches = value.match(pattern);
        if (matches) {
          value = value.replace(pattern, '');
          sanitized = true;
          removedElements.push(...matches);
          warnings.push('Potential XSS content removed');
        }
      }
    }

    // HTML handling
    if (!options.allowHtml) {
      // Escape HTML entities
      const escaped = this.escapeHtml(value);
      if (escaped !== value) {
        value = escaped;
        sanitized = true;
      }
    } else {
      // Sanitize allowed HTML
      const allowedTags = options.allowedTags || this.defaultAllowedTags;
      const htmlSanitized = this.sanitizeHtml(value, allowedTags);
      if (htmlSanitized.sanitized) {
        value = htmlSanitized.value;
        sanitized = true;
        removedElements.push(...htmlSanitized.removedElements);
      }
    }

    // SQL injection detection (for additional security)
    for (const pattern of this.sqlPatterns) {
      if (pattern.test(value)) {
        warnings.push('Potential SQL injection pattern detected');
        logger.security('Potential SQL injection attempt detected', 'medium', {
          component: 'input-sanitizer',
          pattern: pattern.source,
          value: value.substring(0, 100), // Log only first 100 chars
        });
      }
    }

    return {
      value,
      sanitized,
      removedElements,
      warnings,
    };
  }

  /**
   * Sanitize an object recursively
   */
  sanitizeObject(
    obj: Record<string, any>,
    fieldOptions: Record<string, SanitizationOptions> = {}
  ): {
    sanitized: Record<string, any>;
    warnings: Record<string, string[]>;
  } {
    const sanitized: Record<string, any> = {};
    const warnings: Record<string, string[]> = {};

    for (const [key, value] of Object.entries(obj)) {
      const options = fieldOptions[key] || {};

      if (typeof value === 'string') {
        const result = this.sanitizeString(value, options);
        sanitized[key] = result.value;
        if (result.warnings.length > 0) {
          warnings[key] = result.warnings;
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively sanitize nested objects
        const nestedResult = this.sanitizeObject(value, fieldOptions);
        sanitized[key] = nestedResult.sanitized;
        if (Object.keys(nestedResult.warnings).length > 0) {
          warnings[key] = Object.values(nestedResult.warnings).flat();
        }
      } else if (Array.isArray(value)) {
        // Sanitize array elements if they're strings
        sanitized[key] = value.map((item, index) => {
          if (typeof item === 'string') {
            const result = this.sanitizeString(item, options);
            if (result.warnings.length > 0) {
              if (!warnings[key]) warnings[key] = [];
              warnings[key].push(`Array index ${index}: ${result.warnings.join(', ')}`);
            }
            return result.value;
          }
          return item;
        });
      } else {
        sanitized[key] = value;
      }
    }

    return { sanitized, warnings };
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize HTML allowing only specific tags
   */
  private sanitizeHtml(
    html: string,
    allowedTags: string[]
  ): { value: string; sanitized: boolean; removedElements: string[] } {
    const removedElements: string[] = [];
    let value = html;
    let sanitized = false;

    // Remove all tags except allowed ones
    const tagPattern = /<(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\s*[^>]*>/gi;

    value = value.replace(tagPattern, (match, closing, tagName) => {
      if (!allowedTags.includes(tagName.toLowerCase())) {
        removedElements.push(match);
        sanitized = true;
        return '';
      }

      // For allowed tags, strip dangerous attributes
      if (!closing) {
        const sanitizedTag = this.sanitizeTagAttributes(match);
        if (sanitizedTag !== match) {
          sanitized = true;
        }
        return sanitizedTag;
      }

      return match;
    });

    return { value, sanitized, removedElements };
  }

  /**
   * Sanitize HTML tag attributes
   */
  private sanitizeTagAttributes(tag: string): string {
    // Remove all attributes except safe ones (id, class, title)
    const safeAttributes = ['id', 'class', 'title'];

    return tag.replace(/\s+(\w+)\s*=\s*["'][^"']*["']/gi, (match, attrName) => {
      if (safeAttributes.includes(attrName.toLowerCase())) {
        return match;
      }
      return '';
    });
  }

  /**
   * Validate and sanitize file upload
   */
  validateFileUpload(
    file: { name: string; type: string; size: number },
    options: {
      allowedTypes?: string[];
      maxSize?: number;
      allowedExtensions?: string[];
    } = {}
  ): { valid: boolean; errors: string[]; sanitizedName?: string } {
    const errors: string[] = [];

    // Check file type
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      errors.push(`File size ${file.size} exceeds maximum ${options.maxSize} bytes`);
    }

    // Check file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (options.allowedExtensions && extension && !options.allowedExtensions.includes(extension)) {
      errors.push(`File extension .${extension} is not allowed`);
    }

    // Sanitize filename
    const sanitizedName = this.sanitizeFilename(file.name);

    return {
      valid: errors.length === 0,
      errors,
      sanitizedName,
    };
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // Replace dangerous chars with underscore
      .replace(/\.\./g, '_') // Prevent directory traversal
      .replace(/^\.+/, '') // Remove leading dots
      .substring(0, 255); // Limit length
  }

  /**
   * Validate email address
   */
  validateEmail(email: string): { valid: boolean; normalized?: string; errors: string[] } {
    const errors: string[] = [];

    // Basic format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
      return { valid: false, errors };
    }

    // Normalize email (lowercase, trim)
    const normalized = email.toLowerCase().trim();

    // Additional validations
    if (normalized.length > 320) { // RFC 5321 limit
      errors.push('Email address too long');
    }

    const [local, domain] = normalized.split('@');

    if (local.length > 64) {
      errors.push('Email local part too long');
    }

    if (domain.length > 253) {
      errors.push('Email domain too long');
    }

    // Check for common disposable email domains
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
      'mailinator.com', 'throwaway.email'
    ];

    if (disposableDomains.includes(domain)) {
      errors.push('Disposable email addresses are not allowed');
    }

    return {
      valid: errors.length === 0,
      normalized,
      errors,
    };
  }

  /**
   * Validate phone number
   */
  validatePhone(phone: string): { valid: boolean; normalized?: string; errors: string[] } {
    const errors: string[] = [];

    // Remove all non-digit characters for processing
    const digitsOnly = phone.replace(/\D/g, '');

    // Check length (assuming international format)
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      errors.push('Phone number must be between 7 and 15 digits');
    }

    // Basic format check (starts with country code or area code)
    if (digitsOnly.length > 0 && digitsOnly[0] === '0' && digitsOnly.length > 10) {
      errors.push('Invalid international phone number format');
    }

    // Normalize to international format (this is simplified - you'd use a proper library)
    let normalized = digitsOnly;
    if (digitsOnly.length === 10 && !digitsOnly.startsWith('1')) {
      normalized = '1' + digitsOnly; // Assume US number
    }

    return {
      valid: errors.length === 0,
      normalized,
      errors,
    };
  }

  /**
   * Create Zod schema with sanitization preprocessing
   */
  createSanitizedSchema<T extends z.ZodTypeAny>(
    schema: T,
    options: SanitizationOptions = {}
  ): z.ZodTypeAny {
    if (schema instanceof z.ZodString) {
      return schema.transform((value) => {
        const result = this.sanitizeString(value, options);

        // Log warnings if any
        if (result.warnings.length > 0) {
          logger.warn('Input sanitization warnings', {
            component: 'input-sanitizer',
            warnings: result.warnings,
            sanitized: result.sanitized,
          });
        }

        return result.value;
      });
    }

    return schema;
  }
}

// Pre-configured schemas for common use cases
export const sanitizedSchemas = {
  // Basic text input (prevents XSS, trims whitespace)
  text: z.string().transform((value) => {
    const sanitizer = new InputSanitizer();
    return sanitizer.sanitizeString(value, {
      preventXSS: true,
      trimWhitespace: true,
      maxLength: 1000,
    }).value;
  }),

  // Rich text input (allows safe HTML)
  richText: z.string().transform((value) => {
    const sanitizer = new InputSanitizer();
    return sanitizer.sanitizeString(value, {
      allowHtml: true,
      allowedTags: ['p', 'br', 'strong', 'em', 'u', 'i', 'b', 'ul', 'ol', 'li'],
      preventXSS: true,
      maxLength: 5000,
    }).value;
  }),

  // Email validation with sanitization
  email: z.string().transform((value) => {
    const sanitizer = new InputSanitizer();
    const result = sanitizer.validateEmail(value);
    if (!result.valid) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: result.errors.join(', '),
          path: [],
        },
      ]);
    }
    return result.normalized!;
  }),

  // Phone number validation with sanitization
  phone: z.string().transform((value) => {
    const sanitizer = new InputSanitizer();
    const result = sanitizer.validatePhone(value);
    if (!result.valid) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: result.errors.join(', '),
          path: [],
        },
      ]);
    }
    return result.normalized!;
  }),

  // Safe filename
  filename: z.string().transform((value) => {
    const sanitizer = new InputSanitizer();
    return sanitizer.sanitizeString(value, {
      preventXSS: true,
      allowHtml: false,
      maxLength: 255,
    }).value.replace(/[<>:"/\\|?*]/g, '_');
  }),
};

// Validation context for audit logging
export function validateWithContext(
  schema: z.ZodSchema<any>,
  data: any,
  context: ValidationContext
): any {
  try {
    const result = schema.parse(data);

    logger.debug('Input validation successful', {
      component: 'input-validator',
      field: context.field,
      correlationId: context.correlationId,
      userId: context.userId,
    });

    return result;
  } catch (error) {
    logger.warn('Input validation failed', {
      component: 'input-validator',
      field: context.field,
      error: error instanceof z.ZodError ? error.errors : error,
      correlationId: context.correlationId,
      userId: context.userId,
      ip: context.ip,
    });

    throw error;
  }
}

// Export singleton instance
export const inputSanitizer = new InputSanitizer();
