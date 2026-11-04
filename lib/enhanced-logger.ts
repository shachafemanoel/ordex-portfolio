/**
 * Enhanced Structured Logging System
 * Provides correlation IDs, structured context, and performance tracking
 */
import { randomUUID } from 'crypto';

export interface LogContext {
  orderId?: string;
  customerId?: string;
  userId?: string;
  correlationId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  httpStatus?: number;
  userAgent?: string;
  ip?: string;
  method?: string;
  path?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

class EnhancedLogger {
  private serviceName = 'ordex-oms';
  private environment = process.env.NODE_ENV || 'development';

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        service: this.serviceName,
        environment: this.environment,
        correlationId: context.correlationId || this.generateCorrelationId(),
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return entry;
  }

  private generateCorrelationId(): string {
    return randomUUID();
  }

  private log(entry: LogEntry): void {
    const logString = JSON.stringify(entry);

    // In development, also log to console for better DX
    if (this.environment === 'development') {
      const colorMap = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
        fatal: '\x1b[35m', // magenta
      };
      const reset = '\x1b[0m';
      const color = colorMap[entry.level] || reset;

      console.log(`${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`);
      if (entry.error) {
        console.error(entry.error);
      }
    }

    // Always log structured JSON for aggregation
    switch (entry.level) {
      case 'debug':
        console.debug(logString);
        break;
      case 'info':
        console.info(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
      case 'fatal':
        console.error(logString);
        break;
    }
  }

  debug(message: string, context: LogContext): void {
    this.log(this.createLogEntry('debug', message, context));
  }

  info(message: string, context: LogContext): void {
    this.log(this.createLogEntry('info', message, context));
  }

  warn(message: string, context: LogContext, error?: Error): void {
    this.log(this.createLogEntry('warn', message, context, error));
  }

  error(message: string, context: LogContext, error?: Error): void {
    this.log(this.createLogEntry('error', message, context, error));
  }

  fatal(message: string, context: LogContext, error?: Error): void {
    this.log(this.createLogEntry('fatal', message, context, error));
  }

  // Performance logging
  performance(
    operation: string,
    duration: number,
    context: Omit<LogContext, 'duration' | 'operation'>
  ): void {
    this.info(`Operation completed: ${operation}`, {
      ...context,
      operation,
      duration,
    });
  }

  // API request logging
  apiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context: Omit<LogContext, 'method' | 'path' | 'duration' | 'httpStatus'>
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(
      this.createLogEntry(level, `API ${method} ${path} - ${statusCode}`, {
        ...context,
        method,
        path,
        duration,
        httpStatus: statusCode,
      })
    );
  }

  // Audit logging for security-sensitive operations
  audit(
    action: string,
    resource: string,
    context: LogContext
  ): void {
    this.info(`Audit: ${action} on ${resource}`, {
      ...context,
      audit: true,
      action,
      resource,
    });
  }

  // Security event logging
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: LogContext
  ): void {
    const level = severity === 'critical' ? 'fatal' : severity === 'high' ? 'error' : 'warn';
    this.log(
      this.createLogEntry(level, `Security: ${event}`, {
        ...context,
        security: true,
        severity,
        event,
      })
    );
  }
}

export const logger = new EnhancedLogger();

// Helper for measuring operation duration
export function measureDuration<T>(
  operation: () => T | Promise<T>,
  operationName: string,
  context: LogContext
): Promise<T> {
  const start = Date.now();
  const result = Promise.resolve(operation());

  return result
    .then((value) => {
      const duration = Date.now() - start;
      logger.performance(operationName, duration, context);
      return value;
    })
    .catch((error) => {
      const duration = Date.now() - start;
      logger.error(
        `Operation failed: ${operationName}`,
        { ...context, operation: operationName, duration },
        error
      );
      throw error;
    });
}

// Middleware helper for correlation ID extraction
export function getCorrelationId(request: Request): string {
  const header = request.headers.get('x-correlation-id');
  return header || crypto.randomUUID();
}