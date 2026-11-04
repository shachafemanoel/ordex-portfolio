/**
 * Enhanced Order Sync with Comprehensive Error Handling
 * Replacement for existing WooCommerce order integration with better error handling
 */

import { OrderManager } from '@/lib/business-logic';
import { prisma } from '@/lib/db';
import {
  WooCommerceCircuitBreaker,
  WooCommerceErrorHandler,
  WooCommerceOperationHandlers,
} from '@/lib/error-handling/woocommerce-errors';
import { logger } from '@/lib/logger';
import { getWooCommerceConfig } from '@/lib/woocommerce-config';

export interface WooCommerceOrder {
  id: number;
  number: string;
  status: string;
  customer_id: number;
  date_created: string;
  date_modified: string;
  total: string;
  currency: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    subtotal: string;
    total: string;
    sku: string;
  }>;
  payment_method: string;
  payment_method_title: string;
}

export interface SyncResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{
    wooOrderId: number;
    error: string;
    type: string;
    retryable: boolean;
  }>;
  duration: number;
}

export class EnhancedOrderSync {
  private static readonly BATCH_SIZE = 10;
  // private static readonly SYNC_TIMEOUT = 300000; // 5 minutes - Reserved for timeout configuration

  /**
   * Fetch orders from WooCommerce with enhanced error handling
   */
  static async fetchOrdersWithRetry(params: {
    status?: string;
    after?: string;
    before?: string;
    per_page?: number;
    page?: number;
  }): Promise<{ orders: WooCommerceOrder[]; totalPages: number; totalItems: number }> {
    return WooCommerceCircuitBreaker.execute(async () => {
      // Use the centralized configuration service
      const configResult = getWooCommerceConfig();

      if (!configResult.isValid || !configResult.config) {
        logger.error('WooCommerce configuration validation failed', {
          errors: configResult.errors,
          warnings: configResult.warnings,
          component: 'enhanced-order-sync',
        });

        const errorMessage =
          configResult.errors.length > 0
            ? `WooCommerce configuration errors: ${configResult.errors.join(', ')}`
            : 'WooCommerce configuration is invalid';

        throw new Error(errorMessage);
      }

      const config = configResult.config;
      const url = new URL(`${config.apiBaseUrl}/orders`);
      const endpoint = url.toString();

      return WooCommerceOperationHandlers.handleOrderOperation(
        async () => {
          // Add query parameters
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, value.toString());
            }
          });

          const credentials = Buffer.from(
            `${config.consumerKey}:${config.consumerSecret}`
          ).toString('base64');

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          try {
            const response = await fetch(url.toString(), {
              headers: {
                Authorization: `Basic ${credentials}`,
                Accept: 'application/json',
                'User-Agent': 'OMS-WooCommerce-Integration/2.0',
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              // let errorDetails; // Reserved for detailed error logging

              // try {
              //   errorDetails = JSON.parse(errorText);
              // } catch {
              //   // Not JSON
              // }

              if (response.status === 401 || response.status === 403) {
                throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
              }

              if (response.status === 429) {
                throw new Error(`Rate limit exceeded: ${response.status} - ${errorText}`);
              }

              throw new Error(`WooCommerce API error: ${response.status} - ${errorText}`);
            }

            const orders = (await response.json()) as WooCommerceOrder[];
            const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
            const totalItems = parseInt(
              response.headers.get('X-WP-Total') || orders.length.toString()
            );

            return { orders, totalPages, totalItems };
          } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error('WooCommerce API request timeout');
            }
            throw error;
          }
        },
        0, // No specific wooOrderId for batch fetch
        { endpoint }
      );
    });
  }

  /**
   * Process a single order with comprehensive error handling
   */
  static async processOrder(wooOrder: WooCommerceOrder): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
    errorType?: string;
    retryable?: boolean;
  }> {
    return WooCommerceOperationHandlers.handleOrderOperation(async () => {
      // Validate order data
      this.validateOrderData(wooOrder);

      // Create or update order using business logic
      const { order } = await OrderManager.createOrUpdateOrderFromWooCommerce(wooOrder);

      return {
        success: true,
        orderId: order.id,
      };
    }, wooOrder.id).catch((error) => {
      const classifiedError = WooCommerceErrorHandler.classifyError(error, {
        operation: 'process_order',
        wooOrderId: wooOrder.id,
      });

      return {
        success: false,
        error: error.message,
        errorType: classifiedError.type,
        retryable: classifiedError.retryable,
      };
    });
  }

  /**
   * Batch process orders with error handling and partial failure tolerance
   */
  static async batchProcessOrders(orders: WooCommerceOrder[]): Promise<SyncResult> {
    const startTime = Date.now();
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: SyncResult['errors'] = [];

    logger.info('Starting batch order processing', {
      orderCount: orders.length,
      batchSize: this.BATCH_SIZE,
      component: 'enhanced-order-sync',
    });

    // Process orders in batches to avoid overwhelming the system
    for (let i = 0; i < orders.length; i += this.BATCH_SIZE) {
      const batch = orders.slice(i, i + this.BATCH_SIZE);

      logger.info('Processing batch', {
        batchIndex: Math.floor(i / this.BATCH_SIZE) + 1,
        totalBatches: Math.ceil(orders.length / this.BATCH_SIZE),
        batchSize: batch.length,
        component: 'enhanced-order-sync',
      });

      // Process batch with timeout
      const batchPromises = batch.map(async (order) => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Order processing timeout')), 30000)
        );

        try {
          const result = (await Promise.race([this.processOrder(order), timeoutPromise])) as any;

          processed++;

          if (result.success) {
            // Check if it was created or updated
            const existingOrder = await prisma.order.findFirst({
              where: { wooOrderId: order.id.toString() },
            });

            if (existingOrder) {
              updated++;
            } else {
              created++;
            }
          } else {
            failed++;
            errors.push({
              wooOrderId: order.id,
              error: result.error || 'Unknown error',
              type: result.errorType || 'UNKNOWN_ERROR',
              retryable: result.retryable || false,
            });
          }

          return result;
        } catch (error) {
          processed++;
          failed++;

          const classifiedError = WooCommerceErrorHandler.classifyError(error as Error, {
            operation: 'batch_process_order',
            wooOrderId: order.id,
          });

          errors.push({
            wooOrderId: order.id,
            error: (error as Error).message,
            type: classifiedError.type,
            retryable: classifiedError.retryable,
          });

          return { success: false, error: (error as Error).message };
        }
      });

      // Wait for batch to complete
      await Promise.all(batchPromises);

      // Small delay between batches to prevent overwhelming the database
      if (i + this.BATCH_SIZE < orders.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;

    const result: SyncResult = {
      success: failed === 0,
      processed,
      created,
      updated,
      failed,
      errors,
      duration,
    };

    logger.info('Batch order processing completed', {
      ...result,
      successRate:
        processed > 0 ? (((processed - failed) / processed) * 100).toFixed(2) + '%' : '0%',
      component: 'enhanced-order-sync',
    });

    // Store sync result for monitoring
    await this.storeSyncResult(result);

    return result;
  }

  /**
   * Full sync with comprehensive error handling
   */
  static async fullSync(
    params: {
      status?: string;
      after?: string;
      before?: string;
      maxPages?: number;
    } = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let allOrders: WooCommerceOrder[] = [];
    let page = 1;
    const maxPages = params.maxPages || 50; // Safety limit

    logger.info('Starting full WooCommerce order sync', {
      params,
      maxPages,
      component: 'enhanced-order-sync',
    });

    try {
      // Fetch all pages
      while (page <= maxPages) {
        const fetchResult = await this.fetchOrdersWithRetry({
          ...params,
          per_page: 100,
          page,
        });

        allOrders = allOrders.concat(fetchResult.orders);

        logger.info('Fetched page', {
          page,
          ordersOnPage: fetchResult.orders.length,
          totalSoFar: allOrders.length,
          totalPages: fetchResult.totalPages,
          component: 'enhanced-order-sync',
        });

        if (page >= fetchResult.totalPages || fetchResult.orders.length === 0) {
          break;
        }

        page++;
      }

      // Process all orders
      const result = await this.batchProcessOrders(allOrders);

      const { duration: _resultDuration, ...resultWithoutDuration } = result;
      logger.info('Full sync completed', {
        totalOrders: allOrders.length,
        duration: Date.now() - startTime,
        ...resultWithoutDuration,
        component: 'enhanced-order-sync',
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Full sync failed', error, {
        duration,
        ordersProcessed: allOrders.length,
        component: 'enhanced-order-sync',
      });

      return {
        success: false,
        processed: 0,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [
          {
            wooOrderId: 0,
            error: (error as Error).message,
            type: 'SYNC_ERROR',
            retryable: true,
          },
        ],
        duration,
      };
    }
  }

  /**
   * Validate order data before processing
   */
  private static validateOrderData(order: WooCommerceOrder): void {
    if (!order.id) {
      throw new Error('Order ID is required');
    }

    if (!order.number) {
      throw new Error('Order number is required');
    }

    if (!order.status) {
      throw new Error('Order status is required');
    }

    if (!order.billing?.email && !order.billing?.phone) {
      throw new Error('Order must have either email or phone contact');
    }

    if (order.line_items?.length === 0) {
      throw new Error('Order must have at least one line item');
    }

    // Validate line items
    order.line_items?.forEach((item, index) => {
      if (!item.name) {
        throw new Error(`Line item ${index + 1} missing name`);
      }
      if (!item.quantity || item.quantity <= 0) {
        throw new Error(`Line item ${index + 1} has invalid quantity`);
      }
    });
  }

  /**
   * Store sync result for monitoring and analytics
   */
  private static async storeSyncResult(result: SyncResult): Promise<void> {
    try {
      console.log('Sync Result:', {
        providerId: 'woocommerce',
        eventType: 'BULK_SYNC',
        payload: result,
      });
      // WebhookEventLog model removed
      /*
      await prisma.webhookEventLog.create({
        data: {
          providerId: 'woocommerce',
          eventType: 'BULK_SYNC',
          payload: {
            ...result,
            errorSummary: result.errors.length > 0 ? `${result.errors.length} errors occurred` : null,
          } as any,
          status: result.success ? 200 : 500,
          createdAt: new Date(),
        },
      });
      */
    } catch (error) {
      logger.warn('Failed to store sync result', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get sync statistics for monitoring
   */
  static async getSyncStatistics(days: number = 7): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    averageDuration: number;
    totalOrdersProcessed: number;
    errorBreakdown: Record<string, number>;
  }> {
    try {
      // WebhookEventLog model removed, returning default statistics
      return {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageDuration: 0,
        totalOrdersProcessed: 0,
        errorBreakdown: {},
      };
      /*
      const since = new Date();
      since.setDate(since.getDate() - days);

      const syncLogs = await prisma.webhookEventLog.findMany({
        where: {
          providerId: 'woocommerce',
          eventType: 'BULK_SYNC',
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalSyncs = syncLogs.length;
      let successfulSyncs = 0;
      let failedSyncs = 0;
      let totalDuration = 0;
      let totalOrdersProcessed = 0;
      const errorBreakdown: Record<string, number> = {};

      syncLogs.forEach((log) => {
        const result = log.payload as any;

        if (log.status === 200) {
          successfulSyncs++;
        } else {
          failedSyncs++;
        }

        totalDuration += result?.duration || 0;
        totalOrdersProcessed += result.processed || 0;

        // Count errors by type
        if (result.errors) {
          result.errors.forEach((error: any) => {
            errorBreakdown[error.type] = (errorBreakdown[error.type] || 0) + 1;
          });
        }
      });

      return {
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        averageDuration: totalSyncs > 0 ? totalDuration / totalSyncs : 0,
        totalOrdersProcessed,
        errorBreakdown,
      };
      */
    } catch (error) {
      logger.error(
        'Failed to get sync statistics',
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageDuration: 0,
        totalOrdersProcessed: 0,
        errorBreakdown: {},
      };
    }
  }
}
