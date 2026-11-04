/**
 * Order Workflow Service
 * Handles order status transitions and business logic
 *
 * Optimizations:
 * - Redis caching for order detail data
 * - Parallel queries for related entities
 * - Selective includes for performance
 */
import type { OrderDTO, OrderPurchaseOrderSummary } from '@/domain/orders/orderDTO';
import {
  evaluateWorkflow,
  type OrderWorkflowContext,
  type OrderWorkflowSnapshot,
} from '@/domain/orders/orderWorkflow';
import { ApiError } from '@/lib/api-middleware';
import {
  getCachedOrderDetail,
  invalidateOrderCache,
  setCachedOrderDetail,
} from '@/lib/cache/orderCache';
import { prisma } from '@/lib/db';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { ORDER_WITH_RELATIONS_INCLUDE, serializeOrder } from '@/lib/serializers/orderSerializer';
import { isTransitionAllowed } from '@/lib/status-guards';
import { validateTransition } from '@/lib/status-machine';
import type { OrderStatus, Prisma, UserRole } from '@prisma/client';

// Calendar event status types (not an enum in schema, just strings)
type CalendarItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'SCHEDULED';

// Optimized include with status history for timeline
const ORDER_DETAIL_INCLUDE = {
  ...ORDER_WITH_RELATIONS_INCLUDE,
  calendarEvents: {
    orderBy: { startTime: 'asc' },
    take: 10, // Limit to recent events for performance
  },
  shipments: {
    orderBy: { createdAt: 'desc' },
    take: 5, // Limit to recent shipments
  },
  statusHistory: {
    orderBy: { createdAt: 'desc' },
    take: 20, // Include recent status history
    include: {
      changedByUser: {
        select: { id: true, name: true },
      },
    },
  },
  messageLogs: {
    orderBy: { sentAt: 'desc' },
    take: 10, // Include recent messages
    select: {
      id: true,
      channel: true,
      status: true,
      sentAt: true,
      to: true,
    },
  },
  _count: {
    select: {
      noteEntries: true,
    },
  },
} satisfies Prisma.OrderInclude;

type OrderDetailPayload = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

export interface ChangeStatusParams {
  orderId: string;
  targetStatus: OrderStatus;
  reason?: string;
  userId: string;
  userRole: UserRole;
  installAt?: Date;
  installerName?: string;
  installerNotes?: string;
}

export interface ChangeStatusResult {
  success: boolean;
  order: any;
  message?: string;
  error?: string;
}

function buildPurchaseOrderSummary(
  po: Prisma.PurchaseOrderGetPayload<{
    include: {
      supplier: { select: { id: true; name: true } };
      GoodsReceipt: { select: { receivedAt: true }; orderBy: { receivedAt: 'desc' }; take: 1 };
    };
  }>
): OrderPurchaseOrderSummary {
  const expectedAt = po.GoodsReceipt?.[0]?.receivedAt;
  return {
    id: po.id,
    reference: po.reference,
    status: po.status,
    supplierName: po.supplier?.name ?? null,
    expectedAt: expectedAt ? expectedAt.toISOString() : null,
  };
}

function buildWorkflowContext(
  order: OrderDTO,
  record: OrderDetailPayload,
  purchaseOrders: OrderPurchaseOrderSummary[]
): OrderWorkflowContext {
  const statusMap: Record<
    CalendarItemStatus,
    'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  > = {
    PENDING: 'SCHEDULED',
    SCHEDULED: 'SCHEDULED',
    IN_PROGRESS: 'CONFIRMED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  };

  const calendarEvents =
    record.calendarEvents?.map((event) => ({
      id: event.id,
      orderId: order.id,
      title: event.title,
      status: statusMap[event.status as CalendarItemStatus],
      type: event.title?.toUpperCase().includes('INSTALL') ? 'INSTALLATION' : event.status,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      location: event.location ?? undefined,
    })) ?? [];

  const shipments =
    record.shipments?.map((shipment) => ({
      id: shipment.id,
      status: shipment.status,
      deliveredAt: shipment.scheduledAt ? shipment.scheduledAt.toISOString() : null,
    })) ?? [];

  return {
    outstandingBalance: order.outstandingBalance,
    purchaseOrders,
    calendarEvents,
    shipments,
  };
}

function buildWorkflowSnapshot(
  order: OrderDTO,
  record: OrderDetailPayload,
  context: OrderWorkflowContext
): OrderWorkflowSnapshot {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    statusRaw: record.status,
    customer: order.customer,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit,
      total: item.total,
      received: item.received,
    })),
    totalAmount: order.total,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    assignedUserId: order.assignedUser?.id ?? null,
    assignedUserName: order.assignedUser?.name ?? null,
    notesCount: (record._count as any)?.noteEntries ?? 0,
    purchaseOrders: context.purchaseOrders,
    expectedStockAt: context.purchaseOrders.find((po) => po.expectedAt)?.expectedAt ?? null,
    calendarEvents: context.calendarEvents,
    shipments: context.shipments,
    payments:
      order.payments?.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        paidAt: payment.paidAt || null,
      })) ?? [],
    outstandingBalance: order.outstandingBalance,
  };
}

/**
 * Order Workflow Service
 * Provides order status transition logic with business rules
 */
export class OrderWorkflowService {
  /**
   * Get order with workflow data - optimized with caching and parallel queries
   */
  static async getOrderWithWorkflow(orderId: string, skipCache = false) {
    const bypassCache = skipCache || process.env.NODE_ENV === 'test';

    // Check cache first (unless explicitly skipped)
    if (!bypassCache) {
      const cached = await getCachedOrderDetail<{
        order: OrderDTO;
        workflow: ReturnType<typeof evaluateWorkflow>;
        context: OrderWorkflowContext;
      }>(orderId);

      if (cached) {
        console.log(`[OrderWorkflowService] Cache hit for order ${orderId}`);
        return cached;
      }
    }

    const startedAt = Date.now();
    console.log(`[OrderWorkflowService] Loading order ${orderId} (skipCache=${bypassCache})`);

    // Parallel fetch: order data and purchase orders simultaneously
    const [orderRecord, linkedPurchaseOrders] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        include: ORDER_DETAIL_INCLUDE,
      }),
      prisma.purchaseOrder.findMany({
        where: {
          linkedOrderIds: {
            has: orderId,
          },
        },
        include: {
          supplier: {
            select: { id: true, name: true },
          },
          GoodsReceipt: {
            select: { receivedAt: true },
            orderBy: { receivedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    console.log(`[OrderWorkflowService] Query results for ${orderId}`, {
      found: Boolean(orderRecord?.id),
      itemCount: orderRecord?.items?.length ?? 0,
      paymentCount: orderRecord?.payments?.length ?? 0,
      purchaseOrders: linkedPurchaseOrders.length,
      durationMs: Date.now() - startedAt,
    });

    if (!orderRecord) {
      throw new ApiError('order_not_found', 'הזמנה לא נמצאה', 404);
    }

    let orderDTO: OrderDTO;
    try {
      orderDTO = serializeOrder(orderRecord);
    } catch (serializeError) {
      console.error(`[OrderWorkflowService] Failed to serialize order ${orderId}`, {
        error: serializeError,
        orderSummary: {
          id: orderRecord.id,
          status: orderRecord.status,
        },
      });
      throw serializeError;
    }

    const purchaseOrders = linkedPurchaseOrders.map(buildPurchaseOrderSummary);
    const context = buildWorkflowContext(orderDTO, orderRecord, purchaseOrders);
    const snapshot = buildWorkflowSnapshot(orderDTO, orderRecord, context);
    let workflow: ReturnType<typeof evaluateWorkflow>;
    try {
      workflow = evaluateWorkflow(snapshot);
    } catch (workflowError) {
      console.error(`[OrderWorkflowService] Failed to evaluate workflow for order ${orderId}`, {
        error: workflowError,
        snapshotSummary: {
          id: snapshot.id,
          status: snapshot.status,
          purchaseOrders: snapshot.purchaseOrders.length,
          items: snapshot.items.length,
        },
      });
      throw workflowError;
    }

    const result = { order: orderDTO, workflow, context };

    // Cache the result asynchronously (don't block response)
    if (!bypassCache) {
      setCachedOrderDetail(orderId, result).catch((err) => {
        console.warn(`[OrderWorkflowService] Failed to cache order ${orderId}:`, err);
      });
    }

    return result;
  }

  /**
   * Get order with workflow - bypassing cache (for fresh data after mutations)
   */
  static async getOrderWithWorkflowFresh(orderId: string) {
    return this.getOrderWithWorkflow(orderId, true);
  }

  /**
   * Changes the status of an order with validation and business logic
   */
  static async changeStatus(params: ChangeStatusParams): Promise<ChangeStatusResult> {
    const { orderId, targetStatus, reason, userId, installAt, installerName, installerNotes } =
      params;

    try {
      const currentOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: true,
        },
      });

      if (!currentOrder) {
        return {
          success: false,
          order: null,
          error: 'Order not found',
        };
      }

      const normalizedStatus = normalizeOrderStatus(targetStatus);

      const transitionAllowed = validateTransition(currentOrder.status, normalizedStatus);
      if (!transitionAllowed.isValid) {
        throw new Error(transitionAllowed.reason || 'Invalid status transition');
      }

      const guardResult = isTransitionAllowed(currentOrder, normalizedStatus, {
        currentStatus: currentOrder.status,
        additionalData: { installAt },
      });
      if (!guardResult.allowed) {
        throw new Error(guardResult.reason || 'Transition blocked by guards');
      }

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: normalizedStatus,
          ...(installAt && { scheduledAt: installAt }),
          ...(installerName && { assignedInstaller: installerName }),
          ...(installerNotes && { installationNotes: installerNotes }),
        },
        include: {
          customer: true,
          items: true,
        },
      });

      // Calendar sync hook - placeholder for future Google Calendar integration
      if (normalizedStatus === 'SCHEDULED' && installAt) {
        console.log(
          `[Workflow] Order ${orderId} scheduled for ${installAt.toISOString()}. Triggering calendar sync...`
        );
      }

      await prisma.statusHistory.create({
        data: {
          orderId,
          fromStatus: currentOrder.status,
          toStatus: normalizedStatus,
          changedBy: userId,
          reason,
        },
      });

      // Invalidate cache after status change
      await invalidateOrderCache(orderId);

      return {
        success: true,
        order: updatedOrder,
        message: `Order status updated to ${normalizedStatus}`,
      };
    } catch (error) {
      console.error('OrderWorkflowService.changeStatus error:', error);
      throw error instanceof Error ? error : new Error('Failed to change order status');
    }
  }

  /**
   * Invalidate order cache - call after any mutation
   */
  static async invalidateCache(orderId: string): Promise<void> {
    await invalidateOrderCache(orderId);
  }
}
