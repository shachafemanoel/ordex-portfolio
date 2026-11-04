import { isTenantRuntime, requireTenantId } from '@/lib/tenancy/context';
// WooCommerce webhook processor for inbound order events

import { prisma } from '@/lib/db';
import { CustomerSyncService } from '@/lib/services/customerSync';
import { getWooCommerceClient } from '@/lib/woocommerce';
import { WooOrder, WooProduct } from '@/lib/woocommerce/types';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';

// Webhook event validation schema
const WebhookEventSchema = z.object({
  id: z.number(),
  name: z.string(),
  resource: z.string(),
  event: z.string(),
  data: z.object({
    id: z.number().optional(),
  }),
});

export interface WebhookMetrics {
  webhooksProcessed: number;
  webhooksSkipped: number;
  webhooksFailed: number;
  ordersProcessed: number;
  customersUpdated: number;
}

const metrics: WebhookMetrics = {
  webhooksProcessed: 0,
  webhooksSkipped: 0,
  webhooksFailed: 0,
  ordersProcessed: 0,
  customersUpdated: 0,
};

export class WooCommerceWebhookProcessor {
  private static readonly SUPPORTED_EVENTS = [
    'order.created',
    'order.updated',
    'product.created',
    'product.updated',
  ];

  /**
   * Verify WooCommerce webhook signature
   */
  static verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) {
      return false;
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  }

  /**
   * Process webhook event from WooCommerce
   */
  static async processWebhook(
    request: NextRequest,
    rawBody: string
  ): Promise<{ success: boolean; message: string; skipped?: boolean }> {
    try {
      // Verify webhook signature
      const signature = request.headers.get('x-wc-webhook-signature');
      const webhookSecret =
        process.env.WOO_WEBHOOK_SECRET || process.env.WOOCOMMERCE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        throw new Error('WOO_WEBHOOK_SECRET or WOOCOMMERCE_WEBHOOK_SECRET not configured');
      }

      if (!signature) {
        throw new Error('Missing webhook signature');
      }

      if (!this.verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        throw new Error('Invalid webhook signature');
      }

      // Parse and validate webhook event
      const event = WebhookEventSchema.parse(JSON.parse(rawBody));

      // Check if we support this event type
      if (!this.SUPPORTED_EVENTS.includes(event.event)) {
        metrics.webhooksSkipped++;
        return {
          success: true,
          message: `Event ${event.event} not supported`,
          skipped: true,
        };
      }

      // Generate idempotency key from webhook delivery
      const deliveryId = request.headers.get('x-wc-webhook-delivery-id');
      const idempotencyKey = this.generateIdempotencyKey(event, deliveryId);

      // Concurrency guard: acquire transaction-scoped advisory lock
      const lockKey = `woocommerce:${event.event}:${event.data.id ?? 'unknown'}:${deliveryId ?? ''}`;
      try {
        const lockRes = await prisma.$queryRaw<{ acquired: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext(${lockKey})) as acquired
        `;
        if (!lockRes?.[0]?.acquired) {
          // Another worker is processing this event key
          return { success: true, message: 'Event already in progress', skipped: true };
        }
      } catch (e) {
        // If advisory lock function is unavailable, continue without hard failing
        console.warn('Advisory lock unavailable, proceeding without lock');
      }

      // Webhook deduplication requires WebhookEvent model. Skipping for stabilization.
      const existingLog = null;

      if (existingLog) {
        metrics.webhooksSkipped++;
        return {
          success: true,
          message: 'Event already processed',
          skipped: true,
        };
      }

      // Log webhook event
      // Log webhook event (Disabled: Requires WebhookEvent model)
      /*
      await prisma.webhookEvent.create({
        data: {
          providerId: 'woocommerce',
          topic: event.event,
          status: 'DELIVERED',
          payload: {
            ...event,
            idempotency_key: idempotencyKey,
            delivery_id: deliveryId,
            processed_at: new Date().toISOString(),
            ip: this.extractIpAddress(request),
          } as any,
        },
      });
      */

      // Process the event
      if (event.event.startsWith('order.')) {
        await this.processOrderEvent(event, idempotencyKey);
      } else if (event.event.startsWith('product.')) {
        await this.processProductEvent(event, idempotencyKey);
      }

      metrics.webhooksProcessed++;
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      metrics.webhooksFailed++;
      console.error('Webhook processing failed:', error);

      // Log failed webhook attempt
      // Log failed webhook attempt (Disabled: Requires WebhookEvent model)
      /*
      try {
        await prisma.webhookEvent.create({
          data: {
            providerId: 'woocommerce',
            topic: 'unknown',
            status: 'FAILED',
            payload: {
              error: error instanceof Error ? error.message : 'Unknown error',
              raw_body: rawBody,
              timestamp: new Date().toISOString(),
              ip: this.extractIpAddress(request),
            } as any,
          },
        });
      } catch (logError) {
        console.error('Failed to log webhook error:', logError);
      }
      */

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process order-related webhook events
   */
  private static async processOrderEvent(
    event: z.infer<typeof WebhookEventSchema>,
    idempotencyKey: string
  ): Promise<void> {
    if (!event.data.id) {
      throw new Error('Order ID missing from webhook payload');
    }

    const orderId = event.data.id;

    try {
      // Process based on event type
      switch (event.event) {
        case 'order.created':
        case 'order.updated':
          await this.syncOrder(orderId, idempotencyKey);
          break;

        default:
          console.warn(`Unhandled order event: ${event.event}`);
      }
    } catch (error) {
      console.error(`Failed to process order ${orderId} for event ${event.event}:`, error);
      throw error;
    }
  }

  /**
   * Process product-related webhook events
   */
  private static async processProductEvent(
    event: z.infer<typeof WebhookEventSchema>,
    idempotencyKey: string
  ): Promise<void> {
    if (!event.data.id) {
      throw new Error('Product ID missing from webhook payload');
    }

    const productId = event.data.id;

    try {
      switch (event.event) {
        case 'product.created':
        case 'product.updated':
          await this.syncProduct(productId, idempotencyKey);
          break;

        default:
          console.warn(`Unhandled product event: ${event.event}`);
      }
    } catch (error) {
      console.error(`Failed to process product ${productId} for event ${event.event}:`, error);
      throw error;
    }
  }

  /**
   * Public method to sync an order from WooCommerce by ID
   * Fetches fresh data from WooCommerce and updates local database
   */
  static async syncOrder(orderId: number, idempotencyKey?: string): Promise<void> {
    try {
      const wooClient = getWooCommerceClient();
      if (!wooClient) {
        throw new Error('WooCommerce client not configured');
      }

      const order = await wooClient.getOrder(orderId);

      // Generate a pseudo idempotency key if not provided, for logging purposes
      const key = idempotencyKey || `manual_sync_${orderId}_${Date.now()}`;

      await this.processOrderCreatedOrUpdated(order, key);
      metrics.ordersProcessed++;
    } catch (error) {
      console.error(`Failed to sync order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Public method to sync a product from WooCommerce by ID
   */
  static async syncProduct(productId: number, idempotencyKey?: string): Promise<void> {
    try {
      const wooClient = getWooCommerceClient();
      if (!wooClient) {
        throw new Error('WooCommerce client not configured');
      }

      const product = await wooClient.getProduct(productId);
      const key = idempotencyKey || `manual_sync_product_${productId}_${Date.now()}`;

      await this.processProductCreatedOrUpdated(product, key);
    } catch (error) {
      console.error(`Failed to sync product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Process order created/updated events
   */
  private static async processOrderCreatedOrUpdated(
    order: WooOrder,
    idempotencyKey: string
  ): Promise<void> {
    if (!order.id) {
      throw new Error('Order ID is required');
    }

    // Ensure customer exists in WooCommerce if it's a guest order
    let customerId = order.customer_id;
    if (!customerId && order.billing?.email) {
      try {
        customerId = await CustomerSyncService.ensureWooCustomer({
          email: order.billing.email,
          first_name: order.billing.first_name,
          last_name: order.billing.last_name,
          phone: order.billing.phone,
          company: order.billing.company,
          address_1: order.billing.address_1,
          address_2: order.billing.address_2,
          city: order.billing.city,
          state: order.billing.state,
          postcode: order.billing.postcode,
          country: order.billing.country,
        });

        // Update order with customer ID
        const wooClient = getWooCommerceClient();
        if (wooClient && order.status) {
          await wooClient.updateOrderStatus(order.id, order.status);
        }
        order.customer_id = customerId;
      } catch (error) {
        console.error(`Failed to ensure customer for order ${order.id}:`, error);
        // Continue processing even if customer creation fails
      }
    }

    // Update local customer profile with order data
    const customerData = await CustomerSyncService.upsertCustomerProfileFromOrder(order);
    metrics.customersUpdated++;

    if (!customerData) {
      console.warn(`Skipping order sync for ${order.id}: No customer data (email missing?)`);
      return;
    }

    // Update or create minimal local order record for business status tracking
    await this.upsertLocalOrder(order, idempotencyKey, customerData);
  }

  /**
   * Process product created/updated events
   */
  private static async processProductCreatedOrUpdated(
    product: WooProduct,
    idempotencyKey: string
  ): Promise<void> {
    if (!product.id) return;

    // Use product SKU or fallback to WOO-{id}
    const sku = product.sku || `WOO-${product.id}`;
    const name = product.name || `Woo Product ${product.id}`;
    const price = product.price ? Math.round(parseFloat(product.price) * 100) : 0;
    const stock = product.stock_quantity ?? 0;
    const isActive = product.status === 'publish';

    // Clean description (basic HTML stripping if needed, or keep as is)
    // Product model has description as String?
    const description = product.description || product.short_description || '';

    try {
      await prisma.product.upsert({
        where: { tenantId_sku: { tenantId: isTenantRuntime() ? await requireTenantId() : 'legacy', sku } },
        update: {
          name,
          description,
          basePriceCents: price,
          stock,
          isActive,
          updatedAt: new Date(),
        },
        create: {
          sku,
          name,
          description,
          basePriceCents: price,
          stock,
          isActive,
        },
      });
    } catch (error) {
      console.error(`Failed to upsert local product ${product.id} (SKU: ${sku}):`, error);
      throw error;
    }
  }

  /**
   * Create or update minimal local order record
   */
  private static async upsertLocalOrder(
    order: WooOrder,
    idempotencyKey: string,
    customerData: { customerId: string; billingAddressId: string; shippingAddressId: string }
  ): Promise<void> {
    if (!order.id) return;

    try {
      // Map WooCommerce status to OrderStatus
      const status = this.mapWooStatusToOrderStatus(order.status || 'pending');

      // Note: businessStatus field removed - using standard Order.status instead
      // Find existing order by wooOrderId or create new one
      const existingOrder = await prisma.order.findFirst({
        where: { wooOrderId: order.id.toString() },
      });

      const upsertedOrder = existingOrder
        ? await prisma.order.update({
            where: { id: existingOrder.id },
            data: {
              status,
              updatedAt: new Date(),
              // Don't update coordinates unless we have new ones
            },
          })
        : await prisma.order.create({
            data: {
              wooOrderId: order.id.toString(),
              number: order.number?.toString() || `WOO-${order.id}`,
              status,
              // Add required fields with defaults - these should be enriched later
              customerId: customerData.customerId,
              billingAddressId: customerData.billingAddressId,
              shippingAddressId: customerData.shippingAddressId,
              currency: 'ILS',
              // lat, lng, and geoConfidence will be updated later by geocoding service
            },
          });

      // Log status change
      await prisma.statusHistory.create({
        data: {
          orderId: upsertedOrder.id, // Changed from wooOrderId
          toStatus: status,
          reason: `Webhook event: order.${order.status} - Idempotency: ${idempotencyKey}`,
          metadata: { actor: 'woo_webhook' },
        },
      });
    } catch (error) {
      console.error(`Failed to upsert local order ${order.id}:`, error);
      throw error;
    }
  }

  /**
   * Map WooCommerce order status to OrderStatus enum
   * Note: Changed from businessStatus to use standard OrderStatus
   */
  private static mapWooStatusToOrderStatus(
    wooStatus: string
  ): 'TO_DO' | 'PO_CREATED' | 'SUPPLIED' | 'CANCELLED' {
    // Simple mapping from WooCommerce to OrderStatus enum
    const mappings: Record<string, 'TO_DO' | 'PO_CREATED' | 'SUPPLIED' | 'CANCELLED'> = {
      pending: 'TO_DO',
      processing: 'PO_CREATED',
      'on-hold': 'TO_DO',
      completed: 'SUPPLIED',
      cancelled: 'CANCELLED',
      refunded: 'CANCELLED',
      failed: 'CANCELLED',
    };

    return mappings[wooStatus] || 'TO_DO';
  }

  /**
   * Generate idempotency key for webhook deduplication
   */
  private static generateIdempotencyKey(
    event: z.infer<typeof WebhookEventSchema>,
    deliveryId?: string | null
  ): string {
    if (deliveryId) {
      return `${event.event}_${event.data.id}_${deliveryId}`;
    }

    // Fallback to hash-based approach
    const eventData = `${event.event}_${event.data.id}_${event.id}`;
    return crypto.createHash('sha256').update(eventData).digest('hex').substring(0, 32);
  }

  /**
   * Extract IP address from request
   */
  private static extractIpAddress(request: NextRequest): string {
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const xRealIp = request.headers.get('x-real-ip');

    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }

    if (xRealIp) {
      return xRealIp;
    }

    return (request as any).ip || 'unknown';
  }

  /**
   * Get webhook processing metrics
   */
  static getMetrics(): WebhookMetrics {
    return { ...metrics };
  }

  /**
   * Reset metrics (useful for testing)
   */
  static resetMetrics(): void {
    metrics.webhooksProcessed = 0;
    metrics.webhooksSkipped = 0;
    metrics.webhooksFailed = 0;
    metrics.ordersProcessed = 0;
    metrics.customersUpdated = 0;
  }
}
