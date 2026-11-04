/**
 * Order Cancellation Service
 *
 * Handles the complete cancellation workflow for orders:
 * - Validates cancellation eligibility
 * - Cancels related purchase orders
 * - Cancels calendar events
 * - Cancels or completes related tasks
 * - Updates order status with audit trail
 */

import { getPrismaClient } from '@/lib/db';
import { OrderStatus, TaskStatus } from '@prisma/client';
import { auditOrderStatusChange } from '@/lib/audit';

export interface CancelOrderOptions {
  orderId: string;
  reason: string;
  cancelledBy: string;
  cancelRelatedRecords?: boolean; // Default: true
  force?: boolean; // Skip validation checks (admin only)
}

export interface CancelOrderResult {
  success: boolean;
  orderId: string;
  cancelledPurchaseOrders: number;
  cancelledCalendarEvents: number;
  cancelledTasks: number;
  errors?: string[];
  warnings?: string[];
}

/**
 * Cancel an order and cleanup all related records
 */
export async function cancelOrder(options: CancelOrderOptions): Promise<CancelOrderResult> {
  const prisma = getPrismaClient();
  const {
    orderId,
    reason,
    cancelledBy,
    cancelRelatedRecords = true,
    force = false,
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];
  let cancelledPurchaseOrders = 0;
  let cancelledCalendarEvents = 0;
  let cancelledTasks = 0;

  try {
    // 1. Fetch the order with relations
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        tasks: true,
        calendarEvents: true,
      },
    });

    // Fetch related purchase orders separately (no direct relation in schema)
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        linkedOrderIds: { has: orderId },
      },
    });

    if (!order) {
      return {
        success: false,
        orderId,
        cancelledPurchaseOrders: 0,
        cancelledCalendarEvents: 0,
        cancelledTasks: 0,
        errors: ['הזמנה לא נמצאה'],
      };
    }

    // 2. Validate cancellation eligibility (unless forced)
    if (!force) {
      if (order.status === OrderStatus.CANCELLED) {
        return {
          success: false,
          orderId,
          cancelledPurchaseOrders: 0,
          cancelledCalendarEvents: 0,
          cancelledTasks: 0,
          errors: ['ההזמנה כבר מבוטלת'],
        };
      }

      // Warn if order is in advanced stage
      if (order.status === OrderStatus.COMPLETED) {
        warnings.push('ההזמנה כבר הושלמה - מומלץ ליצור החזר במקום ביטול');
      }

      if (order.status === OrderStatus.SCHEDULED && order.scheduledAt) {
        const scheduledDate = new Date(order.scheduledAt);
        const now = new Date();
        const hoursUntil = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntil < 24 && hoursUntil > 0) {
          warnings.push('ההזמנה מתוזמנת בפחות מ-24 שעות - יש לוודא עם הלקוח');
        }
      }
    }

    // 3. Use transaction for atomic updates
    await prisma.$transaction(async (tx) => {
      // 3a. Update order status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          updatedAt: new Date(),
        },
      });

      // 3b. Create status history entry
      await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          changedBy: cancelledBy,
          reason,
          timestamp: new Date(),
          metadata: {
            cancelRelatedRecords,
            force,
          },
        },
      });

      // 3c. Cancel purchase orders (if enabled)
      if (cancelRelatedRecords && purchaseOrders.length > 0) {
        try {
          const result = await tx.purchaseOrder.updateMany({
            where: {
              id: { in: purchaseOrders.map(po => po.id) },
              status: { notIn: ['CANCELLED', 'RECEIVED'] },
            },
            data: {
              status: 'CANCELLED',
              updatedAt: new Date(),
            },
          });
          cancelledPurchaseOrders = result.count;
        } catch (error) {
          warnings.push(`שגיאה בביטול הזמנות רכש: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 3d. Cancel calendar events (if enabled)
      if (cancelRelatedRecords && order.calendarEvents && order.calendarEvents.length > 0) {
        try {
          const result = await tx.calendarEvent.updateMany({
            where: {
              orderId,
              status: { not: 'CANCELLED' },
            },
            data: {
              status: 'CANCELLED',
              updatedAt: new Date(),
            },
          });
          cancelledCalendarEvents = result.count;
        } catch (error) {
          warnings.push(`שגיאה בביטול אירועי יומן: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 3e. Handle tasks (if enabled)
      if (cancelRelatedRecords && order.tasks && order.tasks.length > 0) {
        try {
          // Cancel open tasks
          const result = await tx.task.updateMany({
            where: {
              orderId,
              status: { in: [TaskStatus.OPEN] },
            },
            data: {
              status: TaskStatus.CANCELED,
              updatedAt: new Date(),
            },
          });
          cancelledTasks = result.count;
        } catch (error) {
          warnings.push(`שגיאה בביטול משימות: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    });

    // 4. Audit log (outside transaction for resilience)
    try {
      await auditOrderStatusChange({
        orderId,
        fromStatus: order.status,
        toStatus: OrderStatus.CANCELLED,
        actorId: cancelledBy,
        reason,
      });
    } catch (error) {
      warnings.push('שגיאה ברישום אודיט');
    }

    // 5. Return success result
    return {
      success: true,
      orderId,
      cancelledPurchaseOrders,
      cancelledCalendarEvents,
      cancelledTasks,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('Error cancelling order:', error);
    return {
      success: false,
      orderId,
      cancelledPurchaseOrders,
      cancelledCalendarEvents,
      cancelledTasks,
      errors: [error instanceof Error ? error.message : 'שגיאה לא צפויה'],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

/**
 * Check if an order can be cancelled
 */
export async function canCancelOrder(orderId: string): Promise<{
  canCancel: boolean;
  reason?: string;
  warnings?: string[];
}> {
  const prisma = getPrismaClient();

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
      },
    });

    if (!order) {
      return { canCancel: false, reason: 'הזמנה לא נמצאה' };
    }

    if (order.status === OrderStatus.CANCELLED) {
      return { canCancel: false, reason: 'ההזמנה כבר מבוטלת' };
    }

    const warnings: string[] = [];

    if (order.status === OrderStatus.COMPLETED) {
      warnings.push('ההזמנה הושלמה - מומלץ ליצור החזר במקום ביטול');
    }

    if (order.status === OrderStatus.SCHEDULED && order.scheduledAt) {
      const scheduledDate = new Date(order.scheduledAt);
      const now = new Date();
      const hoursUntil = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil < 24 && hoursUntil > 0) {
        warnings.push('ההזמנה מתוזמנת בפחות מ-24 שעות');
      }
    }

    return {
      canCancel: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      canCancel: false,
      reason: error instanceof Error ? error.message : 'שגיאה בבדיקת זכאות',
    };
  }
}

/**
 * Get cancellation impact summary
 */
export async function getCancellationImpact(orderId: string): Promise<{
  purchaseOrders: number;
  calendarEvents: number;
  openTasks: number;
  totalValue: number;
}> {
  const prisma = getPrismaClient();

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        calendarEvents: {
          where: {
            status: { not: 'CANCELLED' },
          },
        },
        tasks: {
          where: {
            status: TaskStatus.OPEN,
          },
        },
      },
    });

    if (!order) {
      return {
        purchaseOrders: 0,
        calendarEvents: 0,
        openTasks: 0,
        totalValue: 0,
      };
    }

    // Fetch related purchase orders separately
    const purchaseOrders = await prisma.purchaseOrder.count({
      where: {
        linkedOrderIds: { has: orderId },
        status: { notIn: ['CANCELLED', 'RECEIVED'] },
      },
    });

    return {
      purchaseOrders,
      calendarEvents: order.calendarEvents?.length || 0,
      openTasks: order.tasks?.length || 0,
      totalValue: order.totalCents || 0,
    };
  } catch (error) {
    console.error('Error getting cancellation impact:', error);
    return {
      purchaseOrders: 0,
      calendarEvents: 0,
      openTasks: 0,
      totalValue: 0,
    };
  }
}
