/**
 * Structured Logger with Correlation ID Support
 *
 * Provides structured JSON logging with automatic correlation ID injection
 * for distributed tracing and request tracking.
 *
 * @module lib/logger
 */

import { getCorrelationId } from '@/lib/middleware/correlation-id';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
  critical?(message: string, error?: Error | unknown, context?: LogContext): void;
}

/**
 * Structured Logger Implementation
 */
class StructuredLogger implements Logger {
  private readonly isProduction: boolean;
  private readonly enableColors: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.enableColors = !this.isProduction && typeof process !== 'undefined';
  }

  /**
   * Format log entry as JSON string
   */
  private formatLogEntry(entry: LogEntry): string {
    if (this.isProduction) {
      // Production: Pure JSON for log aggregation
      return JSON.stringify(entry);
    } else {
      // Development: Pretty-printed with colors
      const { timestamp, level, message, correlationId, context, error } = entry;
      const parts = [
        `[${timestamp}]`,
        `[${level.toUpperCase()}]`,
        correlationId ? `[${correlationId.substring(0, 8)}]` : '',
        message,
      ];

      let output = parts.filter(Boolean).join(' ');

      if (context && Object.keys(context).length > 0) {
        output += `\n  Context: ${JSON.stringify(context, null, 2)}`;
      }

      if (error) {
        output += `\n  Error: ${error.name}: ${error.message}`;
        if (error.stack) {
          output += `\n${error.stack}`;
        }
      }

      return output;
    }
  }

  /**
   * Safely serialize unknown values for logs.
   */
  private stringifyUnknown(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return String(value);

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Create log entry with correlation ID
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error | unknown
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: getCorrelationId(),
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else {
        const unknownError = error as {
          name?: unknown;
          message?: unknown;
          stack?: unknown;
          code?: unknown;
          meta?: unknown;
        };
        const name = typeof unknownError.name === 'string' ? unknownError.name : 'Unknown';
        let message =
          typeof unknownError.message === 'string'
            ? unknownError.message
            : this.stringifyUnknown(error);
        if (unknownError.code !== undefined) {
          message += ` (code: ${this.stringifyUnknown(unknownError.code)})`;
        }
        if (unknownError.meta !== undefined) {
          message += ` (meta: ${this.stringifyUnknown(unknownError.meta)})`;
        }
        entry.error = {
          name,
          message,
          stack: typeof unknownError.stack === 'string' ? unknownError.stack : undefined,
        };
      }
    }

    return entry;
  }

  /**
   * Log at DEBUG level
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isProduction) {
      const entry = this.createLogEntry('debug', message, context);
      this.safeConsole(() => console.debug(this.formatLogEntry(entry)), entry);
    }
  }

  /**
   * Log at INFO level
   */
  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('info', message, context);
    this.safeConsole(() => console.info(this.formatLogEntry(entry)), entry);
  }

  /**
   * Log at WARN level
   */
  warn(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('warn', message, context);
    this.safeConsole(() => console.warn(this.formatLogEntry(entry)), entry);
  }

  /**
   * Log at ERROR level
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const entry = this.createLogEntry('error', message, context, error);
    this.safeConsole(() => console.error(this.formatLogEntry(entry)), entry);
  }

  /**
   * Log at CRITICAL level (alias to error with higher emphasis)
   */
  critical(message: string, error?: Error | unknown, context?: LogContext): void {
    this.error(message, error, { ...context, severity: 'critical' });
  }

  /**
   * Guard console output to prevent logging failures from breaking request handling.
   */
  private safeConsole(logFn: () => void, entry: LogEntry): void {
    try {
      logFn();
    } catch (err) {
      try {
        console.error('[logger] failed to emit log', {
          originalMessage: entry.message,
          level: entry.level,
          error: err instanceof Error ? err.message : String(err),
        });
      } catch {
        // swallow to avoid cascading failures
      }
    }
  }
}

/**
 * Global logger instance
 */
export const logger: Logger = new StructuredLogger();

/**
 * Create a child logger with fixed context
 *
 * @param defaultContext - context that will be included in all logs
 * @returns logger instance with default context
 */
export function createLogger(defaultContext: LogContext): Logger {
  return {
    debug: (message: string, context?: LogContext) => {
      logger.debug(message, { ...defaultContext, ...context });
    },
    info: (message: string, context?: LogContext) => {
      logger.info(message, { ...defaultContext, ...context });
    },
    warn: (message: string, context?: LogContext) => {
      logger.warn(message, { ...defaultContext, ...context });
    },
    error: (message: string, error?: Error | unknown, context?: LogContext) => {
      logger.error(message, error, { ...defaultContext, ...context });
    },
    critical: (message: string, error?: Error | unknown, context?: LogContext) => {
      logger.critical?.(message, error, { ...defaultContext, ...context });
    },
  };
}

/**
 * Lightweight error tracking hook (safe no-op fallback).
 */
export function trackError(error: Error | unknown, context?: LogContext): void {
  logger.error('Tracked error', error as Error, { component: 'error-tracking', ...context });
}
