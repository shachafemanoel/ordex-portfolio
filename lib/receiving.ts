/**
 * Receiving Service for OrdeX OMS
 * Handles receiving workflow, inventory updates, and status transitions
 */

import { NotFoundError, ValidationError } from '@/lib/api-middleware';
import { OrderStatusManager } from '@/lib/business-logic';
import { prisma, withTransaction, type PrismaTransactionClient } from '@/lib/db';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { evaluateReceivingProgress } from '@/lib/receiving-evaluator';
import { ReceivingNotificationService } from '@/lib/receiving-notifications';
import { OrderAutomationService } from '@/lib/services/order-automation';
import { getStoreSettings } from '@/lib/store-settings';
import type { OrderItem, OrderStatus, Product, Supplier } from '@prisma/client';

// Local interface to replace deleted ReceivingLog model
interface ReceivingLog {
  id: string;
  orderItemId: string;
  quantityReceived: number;
  receivedAt: Date;
  receivedBy: string | null;
  notes?: string | null;
  quantityBefore?: number;
}

export interface ReceiveItemRequest {
  orderItemId: string;
  quantityReceived: number;
  notes?: string;
  photos?: string[]; // Photo URLs or file paths
  userId: string;
  userRole?: string;
}

export interface ReceiveItemResult {
  orderItem: OrderItem;
  receivingLog: ReceivingLog;
  orderStatusChanged: boolean;
  newOrderStatus?: OrderStatus;
  triggeredActions: string[];
}

export interface PendingReceivingItem {
  orderItemId: string;
  orderId: string;
  orderNumber: number;
  customerName: string;
  productId?: string;
  productCode?: string;
  productName?: string;
  skuId?: string;
  skuCode?: string;
  skuName?: string;
  supplierId?: string;
  supplierName?: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityPending: number;
  isFullyReceived: boolean;
  orderStatus: OrderStatus;
  createdAt: Date;
  expectedDelivery?: Date;
}

export interface ReceivingDashboardData {
  pendingItems: PendingReceivingItem[];
  summary: {
    totalPendingOrders: number;
    totalPendingItems: number;
    totalPendingQuantity: number;
    partiallyReceivedOrders: number;
    overdueDeliveries: number;
  };
  supplierBreakdown: Array<{
    supplierId: string;
    supplierName: string;
    pendingItems: number;
    pendingQuantity: number;
    overdueItems: number;
  }>;
}

// Canonical OrderStatus values representing orders that may have items awaiting stock/receiving.
const DEFAULT_RECEIVING_STATUSES: OrderStatus[] = [
  'AWAITING_STOCK', // Orders awaiting stock
  'PARTIALLY_SUPPLIED', // Orders partially received
  'INSTALL_SCHEDULING', // Ready for installation but may still receive items
  'AWAITING_INSTALL', // Scheduled for installation
];

function resolveTargetStatuses(orderStatus?: OrderStatus[]): OrderStatus[] {
  const normalized = (
    orderStatus && orderStatus.length > 0 ? orderStatus : DEFAULT_RECEIVING_STATUSES
  ).map((status) => normalizeOrderStatus(status));
  const unique = Array.from(new Set(normalized));
  return (unique.length > 0 ? unique : DEFAULT_RECEIVING_STATUSES) as OrderStatus[];
}

export class ReceivingService {
  /**
   * Record received items with comprehensive audit trail and automatic status transitions
   */
  static async receiveItems(request: ReceiveItemRequest): Promise<ReceiveItemResult> {
    // Load store settings to determine low stock threshold
    const storeSettings = await getStoreSettings();
    const result = await withTransaction(async (tx) => {
      const { orderItemId, quantityReceived, notes, photos, userId } = request;

      // Validate received quantity
      if (quantityReceived < 0) {
        throw new ValidationError('Received quantity cannot be negative');
      }

      // Get order item with related data
      const orderItem = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        include: {
          order: {
            include: {
              items: true, // Need all items to check if order is fully received
              customer: true,
            },
          },
          supplier: true,
        },
      });

      if (!orderItem) {
        throw new NotFoundError('Order item not found');
      }

      const skuRecord = await this._findSkuRecord(tx, orderItem);

      // Calculate new received quantity
      const previousReceived = orderItem.receivedQuantity;
      const newReceivedQuantity = previousReceived + quantityReceived;

      // Validate that we don't exceed ordered quantity
      if (newReceivedQuantity > orderItem.qty) {
        throw new ValidationError(
          `Cannot receive ${quantityReceived} units. Would exceed ordered quantity of ${orderItem.qty}. Already received: ${previousReceived}`
        );
      }

      // Update order item with new received quantity
      const updatedOrderItem = await tx.orderItem.update({
        where: { id: orderItemId },
        data: {
          receivedQuantity: newReceivedQuantity,
          received: newReceivedQuantity >= orderItem.qty,
          updatedAt: new Date(),
        },
      });

      // Create receiving audit log
      // Create receiving audit log
      // ReceivingLog model removed - logging to console instead
      console.log('Receiving Log:', {
        orderItemId,
        quantityReceived,
        quantityBefore: previousReceived,
        receivedBy: userId,
      });

      const receivingLog: ReceivingLog = {
        id: 'stub-' + Date.now(),
        orderItemId,
        quantityReceived,
        receivedAt: new Date(),
        receivedBy: userId,
        notes,
        quantityBefore: previousReceived,
      };

      /*
      const receivingLog = await tx.receivingLog.create({
        data: {
          orderItemId,
          quantityReceived,
          quantityBefore: previousReceived,
          notes,
          photos: photos ? JSON.parse(JSON.stringify(photos)) : null,
          receivedBy: userId,
        },
      });
      */

      // Update SKU stock if we can resolve a matching SKU record
      // Update SKU stock if we can resolve a matching SKU record
      let updatedSku: Product | null = null;
      if (skuRecord) {
        // Using Product model instead of Sku
        updatedSku = await tx.product.update({
          where: { id: skuRecord.id },
          data: {
            stock: {
              increment: quantityReceived,
            },
            updatedAt: new Date(),
          },
        });
      }

      // Check if order status should be updated based on receiving status
      const orderStatusChange = await this._evaluateOrderStatusChange(tx, orderItem.order, userId);

      const result = {
        orderItem: updatedOrderItem,
        receivingLog,
        orderStatusChanged: orderStatusChange.changed,
        newOrderStatus: orderStatusChange.newStatus,
        triggeredActions: orderStatusChange.triggeredActions,
      };

      // Send notifications asynchronously (don't wait for completion)
      this._sendReceivingNotifications({
        orderItem: updatedOrderItem,
        receivingLog,
        previousStatus: orderItem.order.status as OrderStatus,
        newStatus: orderStatusChange.newStatus,
        orderData: {
          id: orderItem.order.id,
          number: Number.isNaN(Number(orderItem.order.number)) ? 0 : Number(orderItem.order.number),
          customerName: orderItem.order.customer?.name || 'לקוח ללא שם',
          status: (orderStatusChange.newStatus || orderItem.order.status) as OrderStatus,
        },
        skuData:
          skuRecord || orderItem.sku || orderItem.name
            ? {
                code: skuRecord?.sku ?? orderItem.sku ?? undefined,
                name: skuRecord?.name ?? orderItem.name ?? undefined,
                supplierName: skuRecord?.supplier?.name ?? orderItem.supplier?.name,
              }
            : undefined,
      }).catch((error) => {
        console.error('Failed to send receiving notifications:', error);
        // Don't throw - notifications shouldn't break the receiving flow
      });

      // Check for low stock alerts
      const skuForAlerts = updatedSku ?? skuRecord;
      if (skuForAlerts) {
        const threshold = Math.max(
          skuForAlerts.reorderLevel || 0,
          storeSettings.lowStockThreshold || 0
        );
        if (threshold > 0) {
          ReceivingNotificationService.notifyLowStockAlert(
            skuForAlerts.id,
            skuForAlerts.stock,
            threshold
          ).catch((error) => {
            console.error('Failed to send low stock alert:', error);
          });
        }
      }

      return result;
    });

    // After transaction completes, trigger automation for goods received
    if (result && result.orderStatusChanged) {
      OrderAutomationService.onGoodsReceived(result.orderItem.orderId, request.userId).catch(
        (error) => {
          console.error('[ReceivingService] Automation hook failed:', error);
        }
      );
    }

    return result;
  }

  /**
   * Get pending receiving items for dashboard
   */
  static async getPendingReceivingItems(
    filters: {
      supplierId?: string;
      orderStatus?: OrderStatus[];
      overdue?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PendingReceivingItem[]> {
    const { supplierId, orderStatus, overdue, limit = 50, offset = 0 } = filters;
    const statuses = resolveTargetStatuses(orderStatus);

    // Build where conditions
    const whereConditions: any = {
      order: {
        status: {
          in: statuses,
        },
      },
      received: false,
    };

    if (supplierId) {
      whereConditions.supplierId = supplierId;
    }

    // Query pending items
    const items = await prisma.orderItem.findMany({
      where: whereConditions,
      include: {
        order: {
          select: {
            id: true,
            number: true,
            status: true,
            createdAt: true,
            customer: { select: { name: true } },
          },
        },
        product: {
          select: {
            sku: true,
            name: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ order: { createdAt: 'asc' } }, { createdAt: 'asc' }],
      take: limit,
      skip: offset,
    });

    // Gather unique order and supplier IDs to fetch relevant purchase orders
    const orderIds = Array.from(new Set(items.map((item) => item.orderId)));
    const supplierIds = Array.from(
      new Set(items.map((item) => item.supplierId).filter((id): id is string => !!id))
    );

    // Fetch relevant purchase orders to get expected delivery dates
    const purchaseOrders =
      orderIds.length > 0
        ? await prisma.purchaseOrder.findMany({
            where: {
              linkedOrderIds: { hasSome: orderIds },
              supplierId: { in: supplierIds },
              status: { notIn: ['RECEIVED', 'CANCELLED'] },
            },
            select: {
              etaDate: true,
              linkedOrderIds: true,
              supplierId: true,
              items: {
                select: {
                  productId: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];

    // Transform to pending receiving items
    let pendingItems = items.map((item): PendingReceivingItem => {
      // Find a matching purchase order to get the ETA date
      const matchingPO = purchaseOrders.find(
        (po) =>
          po.supplierId === item.supplierId &&
          po.linkedOrderIds.includes(item.orderId) &&
          (!item.productId || po.items.some((poi) => poi.productId === item.productId))
      );

      return {
        orderItemId: item.id,
        orderId: item.order.id,
        orderNumber: Number.isNaN(Number(item.order.number)) ? 0 : Number(item.order.number),
        customerName: item.order.customer?.name || 'לקוח ללא שם',
        productId: item.productId || undefined,
        productCode: item.sku || item.product?.sku || undefined,
        productName: item.name || item.product?.name || undefined,
        skuId: item.productId || undefined,
        skuCode: item.sku || item.product?.sku || undefined,
        skuName: item.name || item.product?.name || undefined,
        supplierId: item.supplier?.id || undefined,
        supplierName: item.supplier?.name || undefined,
        quantityOrdered: item.qty,
        quantityReceived: item.receivedQuantity,
        quantityPending: item.qty - item.receivedQuantity,
        isFullyReceived: item.received,
        orderStatus: item.order.status as OrderStatus,
        createdAt: item.order.createdAt,
        expectedDelivery: matchingPO?.etaDate ?? item.estimatedSupplyAt ?? undefined,
      };
    });

    // Filter overdue items if requested
    if (overdue) {
      const now = new Date();
      const overdueThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      pendingItems = pendingItems.filter(
        (item) =>
          (item.expectedDelivery && item.expectedDelivery < now) ||
          item.createdAt < overdueThreshold
      );
    }

    return pendingItems;
  }

  /**
   * Get receiving dashboard summary data
   */
  static async getReceivingDashboardData(): Promise<ReceivingDashboardData> {
    const [pendingItems, supplierStats] = await Promise.all([
      this.getPendingReceivingItems({ limit: 100 }),
      this._getSupplierReceivingStats(),
    ]);

    // Calculate summary metrics
    const totalPendingOrders = new Set(pendingItems.map((item) => item.orderId)).size;
    const totalPendingItems = pendingItems.length;
    const totalPendingQuantity = pendingItems.reduce((sum, item) => sum + item.quantityPending, 0);
    const partiallyReceivedOrders = new Set(
      pendingItems
        .filter((item) => item.quantityReceived > 0 && !item.isFullyReceived)
        .map((item) => item.orderId)
    ).size;

    const now = new Date();
    const overdueThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const overdueDeliveries = pendingItems.filter(
      (item) =>
        (item.expectedDelivery && item.expectedDelivery < now) || item.createdAt < overdueThreshold
    ).length;

    return {
      pendingItems,
      summary: {
        totalPendingOrders,
        totalPendingItems,
        totalPendingQuantity,
        partiallyReceivedOrders,
        overdueDeliveries,
      },
      supplierBreakdown: supplierStats,
    };
  }

  /**
   * Get receiving history for an order or order item
   */
  static async getReceivingHistory(params: {
    orderId?: string;
    orderItemId?: string;
    limit?: number;
  }): Promise<
    Array<
      ReceivingLog & {
        orderItem: OrderItem & { supplier?: Supplier | null };
        receivedByUser: { name: string | null; email: string } | null;
      }
    >
  > {
    const { orderId, orderItemId, limit = 50 } = params;

    const whereCondition: any = {};

    if (orderItemId) {
      whereCondition.orderItemId = orderItemId;
    } else if (orderId) {
      whereCondition.orderItem = {
        orderId,
      };
    }

    // ReceivingLog model removed - returning empty array
    return [];
    /*
    return await prisma.receivingLog.findMany({
      where: whereCondition,
      include: {
        orderItem: {
          include: {
            supplier: true,
          },
        },
        receivedByUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
    */
  }

  /**
   * Update receiving quantities in bulk for multiple order items
   */
  static async bulkReceiveItems(requests: ReceiveItemRequest[]): Promise<{
    results: ReceiveItemResult[];
    summary: {
      totalItemsProcessed: number;
      successfulReceiving: number;
      errors: Array<{ orderItemId: string; error: string }>;
    };
  }> {
    const results: ReceiveItemResult[] = [];
    const errors: Array<{ orderItemId: string; error: string }> = [];

    for (const request of requests) {
      try {
        const result = await this.receiveItems(request);
        results.push(result);
      } catch (error) {
        errors.push({
          orderItemId: request.orderItemId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      results,
      summary: {
        totalItemsProcessed: requests.length,
        successfulReceiving: results.length,
        errors,
      },
    };
  }

  private static async _findSkuRecord(
    tx: PrismaTransactionClient,
    orderItem: OrderItem
  ): Promise<(Product & { supplier?: Supplier | null }) | null> {
    const searchClauses: Array<{ id?: string; sku?: string }> = [];
    if (orderItem.productId) {
      searchClauses.push({ id: orderItem.productId });
    }
    if (orderItem.sku) {
      searchClauses.push({ sku: orderItem.sku });
    }
    if (searchClauses.length === 0) {
      return null;
    }

    return tx.product
      .findFirst({
        where: {
          OR: searchClauses,
        },
        include: {
          defaultSupplier: true, // mapped to supplier in return type if needed, but type says supplier?
        },
      })
      .then((p) => (p ? { ...p, supplier: p.defaultSupplier } : null)); // Map defaultSupplier to supplier to match expected type
  }

  /**
   * Private method to evaluate if order status should change based on receiving status
   */
  private static async _evaluateOrderStatusChange(
    tx: PrismaTransactionClient,
    order: any,
    userId: string
  ): Promise<{
    changed: boolean;
    newStatus?: OrderStatus;
    triggeredActions: string[];
  }> {
    const triggeredActions: string[] = [];

    // Get all items for the order with updated data
    const allOrderItems = await tx.orderItem.findMany({
      where: { orderId: order.id },
    });

    const evaluation = evaluateReceivingProgress(allOrderItems, order.status as OrderStatus);
    triggeredActions.push(...evaluation.triggeredActions);

    // Apply status change if needed
    if (evaluation.newStatus && evaluation.newStatus !== normalizeOrderStatus(order.status)) {
      try {
        await OrderStatusManager.changeOrderStatus({
          orderId: order.id,
          newStatus: evaluation.newStatus,
          reason: 'Automatic status change based on receiving progress',
          userId,
        });

        return {
          changed: true,
          newStatus: evaluation.newStatus,
          triggeredActions,
        };
      } catch (error) {
        console.warn('Failed to automatically change order status:', error);
        // Don't throw error, receiving should still succeed
      }
    }

    return {
      changed: false,
      triggeredActions,
    };
  }

  /**
   * Send receiving notifications
   */
  private static async _sendReceivingNotifications(context: {
    orderItem: OrderItem;
    receivingLog: ReceivingLog;
    previousStatus: OrderStatus;
    newStatus?: OrderStatus;
    orderData: {
      id: string;
      number: number;
      customerName: string;
      status: OrderStatus;
    };
    skuData?: {
      code: string;
      name: string;
      supplierName?: string;
    };
  }): Promise<void> {
    try {
      await ReceivingNotificationService.notifyReceivingEvent(context);
    } catch (error) {
      console.error('Failed to send receiving notifications:', error);
      // Don't throw - notifications are not critical to the receiving flow
    }
  }

  /**
   * Get supplier receiving statistics
   */
  private static async _getSupplierReceivingStats(): Promise<
    Array<{
      supplierId: string;
      supplierName: string;
      pendingItems: number;
      pendingQuantity: number;
      overdueItems: number;
    }>
  > {
    try {
      // Raw SQL query for better performance with complex aggregations
      // Using canonical OrderStatus values: CONFIRMED covers legacy 'AWAITING_STOCK' and 'PARTIALLY_SUPPLIED'
      const stats = await prisma.$queryRaw<
        Array<{
          supplier_id: string;
          supplier_name: string;
          pending_items: number;
          pending_quantity: number;
          overdue_items: number;
        }>
      >`
        SELECT
          s.id::text as supplier_id,
          s.name as supplier_name,
          COUNT(oi.id)::int as pending_items,
          COALESCE(SUM(oi.qty - oi.received_quantity), 0)::int as pending_quantity,
          COUNT(CASE WHEN o.created_at < NOW() - INTERVAL '7 days' THEN 1 END)::int as overdue_items
        FROM suppliers s
        JOIN order_items oi ON oi.supplier_id = s.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('PO_CREATED', 'AWAITING_STOCK', 'PARTIALLY_SUPPLIED', 'INSTALL_SCHEDULING', 'AWAITING_INSTALL')
          AND (oi.received = false OR oi.received_quantity < oi.qty)
        GROUP BY s.id, s.name
        ORDER BY pending_quantity DESC, pending_items DESC
      `;

      return stats.map((stat) => ({
        supplierId: stat.supplier_id,
        supplierName: stat.supplier_name,
        pendingItems: stat.pending_items,
        pendingQuantity: stat.pending_quantity,
        overdueItems: stat.overdue_items,
      }));
    } catch (error) {
      console.error('Error fetching supplier receiving stats:', error);
      // Return empty array on error to prevent dashboard from breaking
      return [];
    }
  }
}
