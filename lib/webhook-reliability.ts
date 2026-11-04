/**
 * Webhook Reliability System with Retry Patterns
 * Implements robust webhook processing with exponential backoff and dead letter queues
 */

import { LRUCache } from 'lru-cache';
import { logger } from '@/lib/enhanced-logger';
import { isSimpleOmsMode } from '@/lib/simple-oms';

export interface WebhookConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  timeoutMs: number;
  enableDeadLetterQueue: boolean;
  retryableHttpCodes: number[];
}

export interface WebhookJob {
  id: string;
  webhookType: string;
  payload: any;
  attempt: number;
  maxRetries: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  error?: string;
  context: {
    correlationId: string;
    source: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
  };
}

export interface WebhookProcessor {
  type: string;
  handler: (payload: any, context: any) => Promise<void>;
  config?: Partial<WebhookConfig>;
}

export interface WebhookMetrics {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  averageProcessingTime: number;
  successRate: number;
  lastProcessedAt?: Date;
}

function isBuildPhase() {
  const phase = (process.env.NEXT_PHASE || '').toLowerCase();

  return (
    phase === 'phase-production-build' ||
    phase === 'phase-production-serverless' ||
    process.env.RAILWAY_BUILD === 'true' ||
    process.env.DOCKER_BUILD === 'true'
  );
}

export class WebhookQueue {
  private jobs: LRUCache<string, WebhookJob>;
  private processors = new Map<string, WebhookProcessor>();
  private processingTimes: number[] = [];
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  private defaultConfig: WebhookConfig = {
    maxRetries: 3,
    baseDelayMs: 1000, // Start with 1 second
    maxDelayMs: 300000, // Max 5 minutes
    backoffFactor: 2, // Exponential backoff
    timeoutMs: 30000, // 30 second timeout
    enableDeadLetterQueue: true,
    retryableHttpCodes: [500, 502, 503, 504, 408, 429], // Server errors, timeouts, rate limits
  };

  constructor() {
    this.jobs = new LRUCache<string, WebhookJob>({
      max: 5000,
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days safety net
      dispose: (job, id) => {
        if (process.env.DEBUG_MEMORY === '1') {
          console.debug(`[WebhookQueue] Evicted job: ${id}, status: ${job.status}`);
        }
      },
    });

    if (!isSimpleOmsMode() && !isBuildPhase()) {
      this.startProcessing();
    }

    // Run cleanup every hour to remove completed jobs older than 24h
    this.cleanupInterval = setInterval(() => this.cleanup(24), 3600000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  dispose() {
    this.stopProcessing();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.jobs.clear();
    if (process.env.DEBUG_MEMORY === '1') {
      console.debug('[WebhookQueue] Disposed');
    }
  }

  /**
   * Register a webhook processor
   */
  registerProcessor(processor: WebhookProcessor): void {
    this.processors.set(processor.type, processor);

    logger.info(`Registered webhook processor: ${processor.type}`, {
      component: 'webhook-queue',
      processor: processor.type,
    });
  }

  /**
   * Add a webhook job to the queue
   */
  async enqueue(
    webhookType: string,
    payload: any,
    context: WebhookJob['context'],
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): Promise<string> {
    const processor = this.processors.get(webhookType);
    if (!processor) {
      throw new Error(`No processor registered for webhook type: ${webhookType}`);
    }

    const config = { ...this.defaultConfig, ...processor.config };
    const job: WebhookJob = {
      id: crypto.randomUUID(),
      webhookType,
      payload,
      attempt: 0,
      maxRetries: config.maxRetries,
      createdAt: new Date(),
      status: 'pending',
      context: { ...context, priority },
    };

    this.jobs.set(job.id, job);

    logger.info(`Webhook job enqueued: ${webhookType}`, {
      component: 'webhook-queue',
      jobId: job.id,
      webhookType,
      priority,
      correlationId: context.correlationId,
    });

    return job.id;
  }

  /**
   * Start the processing loop
   */
  private startProcessing(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processJobs().catch((batchError) => {
        logger.error(
          'Webhook processing loop error',
          {
            component: 'webhook-queue',
          },
          batchError as any
        );
      });
    }, 1000); // Check every second

    if (this.processingInterval.unref) {
      this.processingInterval.unref();
    }

    logger.info('Webhook processing started', {
      component: 'webhook-queue',
    });
  }

  /**
   * Stop the processing loop
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.isProcessing = false;

    logger.info('Webhook processing stopped', {
      component: 'webhook-queue',
    });
  }

  /**
   * Process pending webhook jobs
   */
  private async processJobs(): Promise<void> {
    const now = new Date();

    // Explicitly iterate to find pending tasks.
    // LRUCache iteration order is most-recently-used, which is fine.
    const pendingJobs: WebhookJob[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === 'pending' && (!job.nextAttemptAt || job.nextAttemptAt <= now)) {
        pendingJobs.push(job);
      }
    }

    pendingJobs.sort(this.prioritySort);

    // Process jobs concurrently but with limit
    const concurrentLimit = 5;
    const batches = this.chunk(pendingJobs, concurrentLimit);

    for (const batch of batches) {
      await Promise.all(batch.map((job) => this.processJob(job)));
    }
  }

  /**
   * Process a single webhook job
   */
  private async processJob(job: WebhookJob): Promise<void> {
    const startTime = Date.now();
    job.status = 'processing';
    job.attempt++;
    job.lastAttemptAt = new Date();

    // Touch in LRU
    this.jobs.set(job.id, job);

    const processor = this.processors.get(job.webhookType);
    if (!processor) {
      job.status = 'failed';
      job.error = `No processor found for webhook type: ${job.webhookType}`;
      return;
    }

    const config = { ...this.defaultConfig, ...processor.config };

    logger.info(`Processing webhook job: ${job.webhookType}`, {
      component: 'webhook-queue',
      jobId: job.id,
      webhookType: job.webhookType,
      attempt: job.attempt,
      maxRetries: job.maxRetries,
      correlationId: job.context.correlationId,
    });

    try {
      // Execute with timeout
      await Promise.race([
        processor.handler(job.payload, job.context),
        this.createTimeoutPromise(config.timeoutMs),
      ]);

      // Success
      job.status = 'completed';
      job.error = undefined;
      this.jobs.set(job.id, job); // Final state save + LRU touch

      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);

      logger.info(`Webhook job completed: ${job.webhookType}`, {
        component: 'webhook-queue',
        jobId: job.id,
        webhookType: job.webhookType,
        attempt: job.attempt,
        processingTime,
        correlationId: job.context.correlationId,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.warn(
        `Webhook job failed: ${job.webhookType}`,
        {
          component: 'webhook-queue',
          jobId: job.id,
          webhookType: job.webhookType,
          attempt: job.attempt,
          maxRetries: job.maxRetries,
          processingTime,
          correlationId: job.context.correlationId,
        },
        error as any
      );

      job.error = errorMessage;

      // Determine if we should retry
      const shouldRetry = this.shouldRetry(error, job, config);

      if (shouldRetry && job.attempt < job.maxRetries) {
        // Schedule retry
        job.status = 'pending';
        job.nextAttemptAt = this.calculateNextAttempt(job.attempt, config);
        this.jobs.set(job.id, job);

        logger.info(`Webhook job scheduled for retry: ${job.webhookType}`, {
          component: 'webhook-queue',
          jobId: job.id,
          webhookType: job.webhookType,
          attempt: job.attempt,
          nextAttemptAt: job.nextAttemptAt.toISOString(),
          correlationId: job.context.correlationId,
        });
      } else {
        // Max retries reached or non-retryable error
        if (config.enableDeadLetterQueue) {
          job.status = 'dead_letter';
          logger.error(`Webhook job moved to dead letter queue: ${job.webhookType}`, {
            component: 'webhook-queue',
            jobId: job.id,
            webhookType: job.webhookType,
            attempt: job.attempt,
            error: errorMessage,
            correlationId: job.context.correlationId,
          });
        } else {
          job.status = 'failed';
          logger.error(`Webhook job permanently failed: ${job.webhookType}`, {
            component: 'webhook-queue',
            jobId: job.id,
            webhookType: job.webhookType,
            attempt: job.attempt,
            error: errorMessage,
            correlationId: job.context.correlationId,
          });
        }
        this.jobs.set(job.id, job);
      }
    }
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(error: any, job: WebhookJob, config: WebhookConfig): boolean {
    // Don't retry if we've exceeded max attempts
    if (job.attempt >= job.maxRetries) {
      return false;
    }

    // Check if it's an HTTP error with retryable status code
    if (error?.response?.status) {
      return config.retryableHttpCodes.includes(error.response.status);
    }

    // Retry on network errors, timeouts, etc.
    if (
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('timeout')
    ) {
      return true;
    }

    // Don't retry on validation errors, auth errors, etc.
    return false;
  }

  /**
   * Calculate next attempt time with exponential backoff
   */
  private calculateNextAttempt(attempt: number, config: WebhookConfig): Date {
    const delay = Math.min(
      config.baseDelayMs * Math.pow(config.backoffFactor, attempt - 1),
      config.maxDelayMs
    );

    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * delay * 0.1;

    return new Date(Date.now() + delay + jitter);
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Webhook processing timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Record processing time for metrics
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);

    // Keep only last 1000 measurements
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }
  }

  /**
   * Priority sort for jobs
   */
  private prioritySort(a: WebhookJob, b: WebhookJob): number {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const aPriority = priorityOrder[a.context.priority || 'normal'];
    const bPriority = priorityOrder[b.context.priority || 'normal'];

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Secondary sort by creation time (FIFO)
    return a.createdAt.getTime() - b.createdAt.getTime();
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get webhook queue metrics
   */
  getMetrics(): WebhookMetrics {
    let total = 0;
    let pending = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;
    let deadLetter = 0;

    for (const job of this.jobs.values()) {
      total++;
      if (job.status === 'pending') pending++;
      else if (job.status === 'processing') processing++;
      else if (job.status === 'completed') completed++;
      else if (job.status === 'failed') failed++;
      else if (job.status === 'dead_letter') deadLetter++;
    }

    const averageProcessingTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
        : 0;

    const successRate = total > 0 ? (completed / total) * 100 : 0;

    let lastProcessedAt: Date | undefined;
    for (const job of this.jobs.values()) {
      if (job.status === 'completed' && job.lastAttemptAt) {
        if (!lastProcessedAt || job.lastAttemptAt > lastProcessedAt) {
          lastProcessedAt = job.lastAttemptAt;
        }
      }
    }

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      deadLetter,
      averageProcessingTime: Math.round(averageProcessingTime * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      lastProcessedAt,
    };
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): WebhookJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: WebhookJob['status']): WebhookJob[] {
    const matched: WebhookJob[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === status) matched.push(job);
    }
    return matched;
  }

  /**
   * Retry a failed or dead letter job
   */
  retryJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || (job.status !== 'failed' && job.status !== 'dead_letter')) {
      return false;
    }

    job.status = 'pending';
    job.attempt = 0;
    job.nextAttemptAt = undefined;
    job.error = undefined;
    this.jobs.set(jobId, job); // touch LRU

    logger.info(`Manual retry triggered for webhook job: ${job.webhookType}`, {
      component: 'webhook-queue',
      jobId: job.id,
      webhookType: job.webhookType,
      correlationId: job.context.correlationId,
    });

    return true;
  }

  /**
   * Clean up old completed jobs
   */
  cleanup(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleaned = 0;

    for (const job of this.jobs.values()) {
      if (job.status === 'completed' && job.lastAttemptAt && job.lastAttemptAt < cutoffTime) {
        this.jobs.delete(job.id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old webhook jobs`, {
        component: 'webhook-queue',
        cleaned,
        cutoffTime: cutoffTime.toISOString(),
      });
    }

    return cleaned;
  }
}

// Singleton instance
export const webhookQueue = new WebhookQueue();

// Example webhook processors
export const defaultWebhookProcessors = {
  'woocommerce-order-created': {
    type: 'woocommerce-order-created',
    handler: async (payload: any, context: any) => {
      // Import and process WooCommerce order
      logger.info('Processing WooCommerce order webhook', {
        component: 'webhook-processor',
        webhookType: 'woocommerce-order-created',
        orderId: payload.id,
        correlationId: context.correlationId,
      });

      // Actual processing would go here
      // await importWooCommerceOrder(payload);
    },
    config: {
      maxRetries: 5,
      baseDelayMs: 2000,
      timeoutMs: 30000,
    },
  },

  'google-calendar-sync': {
    type: 'google-calendar-sync',
    handler: async (payload: any, context: any) => {
      logger.info('Processing Google Calendar sync webhook', {
        component: 'webhook-processor',
        webhookType: 'google-calendar-sync',
        eventId: payload.eventId,
        correlationId: context.correlationId,
      });

      // Actual calendar sync would go here
      // await syncCalendarEvent(payload);
    },
    config: {
      maxRetries: 3,
      baseDelayMs: 1000,
      timeoutMs: 15000,
    },
  },
};

// Register default processors
if (!isSimpleOmsMode() && !isBuildPhase()) {
  for (const processor of Object.values(defaultWebhookProcessors)) {
    webhookQueue.registerProcessor(processor);
  }
}
