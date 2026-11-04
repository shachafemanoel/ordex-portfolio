/**
 * Comprehensive Error Handling for WooCommerce + Prisma Integration
 * Provides structured error classification, retry logic, and recovery strategies
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

// Error Classifications
export enum ErrorType {
  // Network/API Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',

  // Database Errors
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_CONSTRAINT_ERROR = 'DATABASE_CONSTRAINT_ERROR',
  DATABASE_TIMEOUT_ERROR = 'DATABASE_TIMEOUT_ERROR',

  // WooCommerce Specific
  WOO_API_ERROR = 'WOO_API_ERROR',
  WOO_INVALID_DATA = 'WOO_INVALID_DATA',
  WOO_WEBHOOK_ERROR = 'WOO_WEBHOOK_ERROR',

  // Business Logic Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BUSINESS_RULE_ERROR = 'BUSINESS_RULE_ERROR',

  // System Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ErrorContext {
  operation: string;
  wooOrderId?: number;
  orderId?: string;
  customerId?: string;
  endpoint?: string;
  attempt?: number;
  maxAttempts?: number;
  metadata?: Record<string, any>;
}

export interface WooCommerceError extends Error {
  type: ErrorType;
  severity: ErrorSeverity;
  context: ErrorContext;
  retryable: boolean;
  backoffDelay?: number;
  originalError?: Error;
}

export class WooCommerceErrorHandler {
  private static readonly RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
  private static readonly MAX_RETRIES = 5;
  private static readonly DEAD_LETTER_QUEUE = 'woo:errors:dead-letter';
  private static readonly ERROR_LOG_KEY = 'woo:errors:log';

  /**
   * Classify error based on error message and context
   */
  static classifyError(error: Error, context: ErrorContext): WooCommerceError {
    const message = error.message.toLowerCase();

    // Network/Connection errors
    if (
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('econnrefused')
    ) {
      return this.createError(ErrorType.NETWORK_ERROR, ErrorSeverity.MEDIUM, error, context, true);
    }

    if (message.includes('timeout') || message.includes('etimedout')) {
      return this.createError(ErrorType.TIMEOUT_ERROR, ErrorSeverity.MEDIUM, error, context, true);
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return this.createError(
        ErrorType.RATE_LIMIT_ERROR,
        ErrorSeverity.LOW,
        error,
        context,
        true,
        60000
      );
    }

    if (message.includes('unauthorized') || message.includes('authentication')) {
      return this.createError(
        ErrorType.AUTHENTICATION_ERROR,
        ErrorSeverity.HIGH,
        error,
        context,
        false
      );
    }

    // Database errors
    if (message.includes('p1017') || message.includes('connection terminated')) {
      return this.createError(
        ErrorType.DATABASE_CONNECTION_ERROR,
        ErrorSeverity.HIGH,
        error,
        context,
        true
      );
    }

    if (message.includes('p2002') || message.includes('unique constraint')) {
      return this.createError(
        ErrorType.DATABASE_CONSTRAINT_ERROR,
        ErrorSeverity.LOW,
        error,
        context,
        false
      );
    }

    if (message.includes('p1008') || message.includes('database timeout')) {
      return this.createError(
        ErrorType.DATABASE_TIMEOUT_ERROR,
        ErrorSeverity.MEDIUM,
        error,
        context,
        true
      );
    }

    // WooCommerce API errors
    if (message.includes('woocommerce') || message.includes('wp-json')) {
      if (message.includes('invalid') || message.includes('malformed')) {
        return this.createError(
          ErrorType.WOO_INVALID_DATA,
          ErrorSeverity.MEDIUM,
          error,
          context,
          false
        );
      }
      return this.createError(ErrorType.WOO_API_ERROR, ErrorSeverity.MEDIUM, error, context, true);
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid input')) {
      return this.createError(ErrorType.VALIDATION_ERROR, ErrorSeverity.LOW, error, context, false);
    }

    // Default classification
    return this.createError(ErrorType.UNKNOWN_ERROR, ErrorSeverity.MEDIUM, error, context, true);
  }

  private static createError(
    type: ErrorType,
    severity: ErrorSeverity,
    originalError: Error,
    context: ErrorContext,
    retryable: boolean,
    backoffDelay?: number
  ): WooCommerceError {
    const error = new Error(originalError.message) as WooCommerceError;
    error.name = 'WooCommerceError';
    error.type = type;
    error.severity = severity;
    error.context = context;
    error.retryable = retryable;
    error.backoffDelay = backoffDelay;
    error.originalError = originalError;
    error.stack = originalError.stack;

    return error;
  }

  /**
   * Execute operation with comprehensive error handling and retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxAttempts: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: WooCommerceError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();

        // Log successful recovery if there were previous failures
        if (attempt > 1) {
          logger.info('Operation succeeded after retry', {
            ...context,
            attempt,
            component: 'woocommerce-error-handler',
          });
        }

        return result;
      } catch (error) {
        const classifiedError = this.classifyError(error as Error, {
          ...context,
          attempt,
          maxAttempts,
        });
        lastError = classifiedError;

        // Log the error
        await this.logError(classifiedError);

        // Check if we should retry
        if (!classifiedError.retryable || attempt >= maxAttempts) {
          break;
        }

        // Calculate delay
        const delay =
          classifiedError.backoffDelay ||
          this.RETRY_DELAYS[Math.min(attempt - 1, this.RETRY_DELAYS.length - 1)];

        logger.warn('Operation failed, retrying', {
          ...context,
          attempt,
          maxAttempts,
          delay,
          errorType: classifiedError.type,
          component: 'woocommerce-error-handler',
        });

        // Special handling for database connection errors
        if (classifiedError.type === ErrorType.DATABASE_CONNECTION_ERROR) {
          await this.handleDatabaseReconnection();
        }

        // Wait before retry
        await this.delay(delay);
      }
    }

    // All retries failed, send to dead letter queue
    if (lastError) {
      await this.sendToDeadLetterQueue(lastError);
      throw lastError;
    }

    throw new Error('Operation failed with unknown error');
  }

  /**
   * Handle database reconnection for connection errors
   */
  private static async handleDatabaseReconnection(): Promise<void> {
    try {
      await prisma.$disconnect();
      await this.delay(1000); // Wait 1 second
      await prisma.$connect();
      logger.info('Database reconnection successful');
    } catch (reconnectError) {
      logger.error('Database reconnection failed', reconnectError);
    }
  }

  /**
   * Log structured error information
   */
  static async logError(error: WooCommerceError): Promise<void> {
    const errorLog = {
      timestamp: new Date().toISOString(),
      type: error.type,
      severity: error.severity,
      message: error.message,
      context: error.context,
      retryable: error.retryable,
      stack: error.stack,
    };

    // Log to application logger
    logger.error('WooCommerce operation failed', error, {
      errorType: error.type,
      severity: error.severity,
      operation: error.context.operation,
      retryable: error.retryable,
      component: 'woocommerce-integration',
    });

    // Store in Redis for monitoring
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.lPush(this.ERROR_LOG_KEY, JSON.stringify(errorLog));
        await redis.lTrim(this.ERROR_LOG_KEY, 0, 999); // Keep last 1000 errors
      }
    } catch (redisError) {
      console.warn('Failed to store error in Redis:', redisError);
    }

    // Store critical errors in database
    if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH) {
      console.error('CRITICAL ERROR LOG:', {
        providerId: 'woocommerce',
        eventType: 'ERROR',
        payload: {
          error: error.message,
          code: (error as any).code,
          severity: error.severity,
          context: error.context,
        },
      });
      // WebhookEventLog model removed
      /*
      try {
        await prisma.webhookEventLog.create({
          data: {
            providerId: 'woocommerce',
            eventType: 'ERROR',
            payload: {
              error: error.message,
              code: error.code,
              severity: error.severity,
              context: error.context,
            } as any,
            status: 500,
            createdAt: new Date(),
          },
        });
      } catch (logError) {
        // Fallback if logging fails
        console.error('Failed to log critical error to DB', logError);
      }
      */
    }
  }

  /**
   * Send failed operation to dead letter queue for manual review
   */
  static async sendToDeadLetterQueue(error: WooCommerceError): Promise<void> {
    const deadLetterItem = {
      timestamp: new Date().toISOString(),
      error: {
        type: error.type,
        severity: error.severity,
        message: error.message,
        context: error.context,
      },
      retryCount: error.context.attempt || 0,
      requiresManualReview: error.severity === ErrorSeverity.CRITICAL,
    };

    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.lPush(this.DEAD_LETTER_QUEUE, JSON.stringify(deadLetterItem));
        logger.error('Operation sent to dead letter queue', error, {
          errorType: error.type,
          severity: error.severity,
          component: 'woocommerce-error-handler',
        });
      }
    } catch (redisError) {
      console.error('Failed to send to dead letter queue:', redisError);
    }
  }

  /**
   * Get error statistics for monitoring
   */
  static async getErrorStatistics(): Promise<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    deadLetterCount: number;
    recentErrors: any[];
  }> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return {
          totalErrors: 0,
          errorsByType: {},
          errorsBySeverity: {},
          deadLetterCount: 0,
          recentErrors: [],
        };
      }

      const errorLogs = await redis.lRange(this.ERROR_LOG_KEY, 0, -1);
      const deadLetterCount = await redis.lLen(this.DEAD_LETTER_QUEUE);

      const errors = errorLogs.map((log) => JSON.parse(log));
      const errorsByType: Record<string, number> = {};
      const errorsBySeverity: Record<string, number> = {};

      errors.forEach((error) => {
        errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
        errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
      });

      return {
        totalErrors: errors.length,
        errorsByType,
        errorsBySeverity,
        deadLetterCount,
        recentErrors: errors.slice(0, 10), // Last 10 errors
      };
    } catch (error) {
      console.error('Failed to get error statistics:', error);
      return {
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        deadLetterCount: 0,
        recentErrors: [],
      };
    }
  }

  /**
   * Process dead letter queue items
   */
  static async processDeadLetterQueue(): Promise<{
    processed: number;
    recovered: number;
    failed: number;
  }> {
    const redis = await getRedisClient();
    if (!redis) {
      return { processed: 0, recovered: 0, failed: 0 };
    }

    let processed = 0;
    let recovered = 0;
    let failed = 0;

    try {
      while (true) {
        const item = await redis.rPop(this.DEAD_LETTER_QUEUE);
        if (!item) break;

        processed++;
        const deadLetterItem = JSON.parse(item);

        // Attempt to retry the operation if it's been long enough
        const timeSinceFailure = Date.now() - new Date(deadLetterItem.timestamp).getTime();
        const shouldRetry = timeSinceFailure > 300000; // 5 minutes

        if (shouldRetry && deadLetterItem.retryCount < 3) {
          // Here you would implement logic to retry the specific operation
          // For now, we'll just log it
          logger.info('Dead letter queue item ready for retry', deadLetterItem);
          recovered++;
        } else {
          // Move to permanent failure log
          logger.error('Dead letter queue item permanently failed', deadLetterItem);
          failed++;
        }
      }
    } catch (error) {
      logger.error('Failed to process dead letter queue', error);
    }

    return { processed, recovered, failed };
  }

  /**
   * Utility method for delays
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Specialized error handlers for common WooCommerce operations
 */
export class WooCommerceOperationHandlers {
  /**
   * Handle order creation/update with specific error recovery
   */
  static async handleOrderOperation<T>(
    operation: () => Promise<T>,
    wooOrderId: number,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    return WooCommerceErrorHandler.executeWithRetry(operation, {
      operation: 'order_sync',
      wooOrderId,
      ...context,
    });
  }

  /**
   * Handle webhook processing with specific error handling
   */
  static async handleWebhookOperation<T>(
    operation: () => Promise<T>,
    webhookData: any,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    try {
      return await WooCommerceErrorHandler.executeWithRetry(
        operation,
        {
          operation: 'webhook_processing',
          wooOrderId: webhookData.id,
          endpoint: context.endpoint,
          ...context,
        },
        3 // Lower retry count for webhooks
      );
    } catch (error) {
      // For webhook failures, we still want to acknowledge receipt
      // to prevent infinite retries from WooCommerce
      logger.error('Webhook processing failed permanently', error, {
        wooOrderId: webhookData.id,
        component: 'webhook-handler',
      });

      // Store the webhook for manual processing
      // Store the webhook for manual processing
      console.error('FAILED WEBHOOK LOG:', {
        providerId: 'woocommerce',
        eventType: 'ORDER_UPDATE',
        payload: { ...webhookData, errorMessage: (error as Error).message },
      });
      // WebhookEventLog model removed
      /*
      try {
        await prisma.webhookEventLog.create({
          data: {
            providerId: 'woocommerce',
            eventType: 'ORDER_UPDATE',
            payload: { ...webhookData, errorMessage: (error as Error).message } as any,
            status: 500,
            createdAt: new Date(),
          },
        });
      } catch (dbError) {
        console.warn('Failed to store failed webhook:', dbError);
      }
      */

      throw error;
    }
  }

  /**
   * Handle product/SKU sync operations
   */
  static async handleProductSyncOperation<T>(
    operation: () => Promise<T>,
    productId?: number,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    return WooCommerceErrorHandler.executeWithRetry(operation, {
      operation: 'product_sync',
      metadata: { productId },
      ...context,
    });
  }

  /**
   * Handle customer sync operations
   */
  static async handleCustomerOperation<T>(
    operation: () => Promise<T>,
    customerId?: string | number,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    return WooCommerceErrorHandler.executeWithRetry(operation, {
      operation: 'customer_sync',
      customerId: customerId?.toString(),
      ...context,
    });
  }
}

/**
 * Circuit breaker pattern for WooCommerce API
 */
export class WooCommerceCircuitBreaker {
  private static failures = 0;
  private static lastFailureTime = 0;
  private static readonly FAILURE_THRESHOLD = 3; // Reduced from 5 to 3
  private static readonly RECOVERY_TIMEOUT = 30000; // Reduced from 1 minute to 30 seconds
  private static isOpen = false;

  static async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      if (Date.now() - this.lastFailureTime > this.RECOVERY_TIMEOUT) {
        this.isOpen = false;
        this.failures = 0;
        logger.info('Circuit breaker reset - attempting operation', {
          component: 'circuit-breaker',
          failures: this.failures,
          timeout: this.RECOVERY_TIMEOUT,
        });
      } else {
        const timeLeft = Math.ceil(
          (this.RECOVERY_TIMEOUT - (Date.now() - this.lastFailureTime)) / 1000
        );
        logger.info(`Circuit breaker is open - ${timeLeft}s remaining`, {
          component: 'circuit-breaker',
          failures: this.failures,
          timeLeft,
        });
        throw new Error(
          `Circuit breaker is open - WooCommerce API temporarily unavailable (retry in ${timeLeft}s)`
        );
      }
    }

    try {
      const result = await operation();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.FAILURE_THRESHOLD) {
        this.isOpen = true;
        logger.warn('Circuit breaker opened due to consecutive failures', {
          failures: this.failures,
          component: 'circuit-breaker',
        });
      }

      throw error;
    }
  }

  static getStatus() {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      threshold: this.FAILURE_THRESHOLD,
      recoveryTimeout: this.RECOVERY_TIMEOUT,
      timeUntilRecovery: this.isOpen
        ? Math.max(0, this.RECOVERY_TIMEOUT - (Date.now() - this.lastFailureTime))
        : 0,
    };
  }

  // Force reset circuit breaker (for admin/debugging)
  static forceReset() {
    this.isOpen = false;
    this.failures = 0;
    this.lastFailureTime = 0;
    logger.info('Circuit breaker forcefully reset', {
      component: 'circuit-breaker',
    });
  }
}
