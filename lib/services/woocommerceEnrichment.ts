import { prisma } from '@/lib/db';
import { getWooCommerceClient } from '@/lib/woocommerce';

export interface EnrichmentCompleteness {
  isComplete: boolean;
  missingFields: string[];
}

export interface EnrichmentResult {
  success: boolean;
  error?: string;
  completeness?: EnrichmentCompleteness;
}

export class WooCommerceEnrichmentService {
  static async enrichOrder(orderId: string): Promise<EnrichmentResult> {
    const order = await (prisma as any).order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        wooOrderId: true,
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const baseUpdate = {
      lastEnrichmentAt: new Date(),
      enrichmentAttempts: { increment: 1 },
    };

    if (!order.wooOrderId) {
      await (prisma as any).order.update({
        where: { id: orderId },
        data: baseUpdate,
      });
      return { success: false, error: 'Order is not linked to WooCommerce' };
    }

    const client = getWooCommerceClient();
    if (!client) {
      await (prisma as any).order.update({
        where: { id: orderId },
        data: baseUpdate,
      });
      return { success: false, error: 'WooCommerce client not configured' };
    }

    try {
      const wooOrder = await client.getOrder(Number(order.wooOrderId));
      const customerName = [wooOrder.billing?.first_name, wooOrder.billing?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      const missingFields = [
        !wooOrder.billing?.email ? 'billing.email' : null,
        !wooOrder.line_items?.length ? 'line_items' : null,
        !wooOrder.shipping?.address_1 && !wooOrder.billing?.address_1 ? 'address' : null,
      ].filter((field): field is string => field !== null);

      await (prisma as any).order.update({
        where: { id: orderId },
        data: {
          ...baseUpdate,
          customerName: customerName || undefined,
          customerEmail: wooOrder.billing?.email || undefined,
          customerPhone: wooOrder.billing?.phone || undefined,
          addressLine:
            wooOrder.shipping?.address_1 ||
            wooOrder.billing?.address_1 ||
            undefined,
          city: wooOrder.shipping?.city || wooOrder.billing?.city || undefined,
        },
      });

      return {
        success: true,
        completeness: {
          isComplete: missingFields.length === 0,
          missingFields,
        },
      };
    } catch (error) {
      await (prisma as any).order.update({
        where: { id: orderId },
        data: baseUpdate,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enrich order',
      };
    }
  }
}
