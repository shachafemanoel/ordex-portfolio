import { prisma } from '@/lib/db';
import { buildOrderSnapshot } from '@/lib/orders/rules/orderSnapshot';
import { OrdersRepository } from '@/src/server/data/repositories/orders.repository';
import { OrderActionRegistry } from '@/src/server/domain/orders/actions';
import { ActionPayload, ExecuteActionResult, OpsActionType } from '@/src/server/domain/orders/dto';
import { OrderDomain } from '@/src/server/domain/orders/model';
import { computeDrillState } from '@/src/server/domain/orders/policies/reconcile';
import {
  OrderFilters,
  OrderListItem,
  OrderNotFoundError,
  OrderWithRelations,
} from '@/src/server/domain/orders/types';
import { computeTriggers } from '@/src/server/services/ops-triggers.service';

export class OrdersService {
  private readonly ordersRepository = new OrdersRepository();

  async getOrderById(id: string): Promise<OrderWithRelations> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new OrderNotFoundError(id);
    }
    return order;
  }

  async getOrders(filters: OrderFilters = {}): Promise<OrderListItem[]> {
    return this.ordersRepository.findMany(filters);
  }

  async getOrdersCount(filters: OrderFilters = {}): Promise<number> {
    return this.ordersRepository.count(filters.where);
  }

  async executeAction(
    orderId: string,
    actionType: OpsActionType,
    payload: ActionPayload,
    userId: string
  ): Promise<ExecuteActionResult> {
    // 1. Load Order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shippingAddress: true,
        calendarEvents: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { linkedOrderIds: { has: orderId } },
    });

    const orderDomain: OrderDomain = {
      ...order,
      relatedPurchaseOrders: purchaseOrders,
    };

    // 2. Resolve Action Handler
    const actionHandler = OrderActionRegistry[actionType];
    if (!actionHandler) {
      throw new Error(`Unknown action type: ${actionType}`);
    }

    // 3. Execute Action
    const actionResult = await actionHandler(orderDomain, payload, { userId, now: new Date() });
    const { mutatedOrder, mutatedItems, events } = actionResult;

    // 4. Reconcile State & Triggers
    const newItems = mutatedItems
      ? orderDomain.items.map((i) => mutatedItems.find((mi) => mi.id === i.id) || i)
      : orderDomain.items;

    const newDomain: OrderDomain = {
      ...mutatedOrder,
      items: newItems,
      relatedPurchaseOrders: purchaseOrders,
    };

    const snapshot = buildOrderSnapshot(newDomain as any);

    const drillState = computeDrillState({
      snapshot,
      opsChecklistState: newDomain.opsChecklistState as any,
      opsSnoozeUntil: newDomain.opsSnoozeUntil,
      opsSnoozeReason: newDomain.opsSnoozeReason,
    });

    const triggerInput = {
      status: newDomain.status,
      taskLabel: drillState.currentTask.taskLabel,
      opsLane: newDomain.opsLane,
      opsSnoozeUntil: newDomain.opsSnoozeUntil,
      scheduledAt: newDomain.scheduledAt,
      urgent: newDomain.urgent,
      lastActionAt: newDomain.lastActionAt,
      createdAt: newDomain.createdAt,
      items: newItems,
    };
    const triggers = computeTriggers(triggerInput);

    // 5. Persist
    await prisma.$transaction(async (tx: any) => {
      // Update Order
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: newDomain.status,
          opsLane: newDomain.opsLane,
          opsSnoozeUntil: newDomain.opsSnoozeUntil,
          opsSnoozeReason: newDomain.opsSnoozeReason,
          scheduledAt: newDomain.scheduledAt,
          lastActionAt: newDomain.lastActionAt,
          workingByUserId: newDomain.workingByUserId,
          workingStartedAt: newDomain.workingStartedAt,
          completedAt: newDomain.completedAt,
          notesInternal: newDomain.notesInternal,

          opsCurrentTask: drillState.currentTask.taskLabel,
          urgent: triggers.isUrgent,
        },
      });

      // Update Items
      if (mutatedItems && mutatedItems.length > 0) {
        for (const item of mutatedItems) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              receivedQuantity: item.receivedQuantity,
              sentToSupplierAt: item.sentToSupplierAt,
              estimatedSupplyAt: item.estimatedSupplyAt,
              allocationStatus: item.allocationStatus,
            },
          });
        }
      }

      // Audit Events
      if (events && events.length > 0) {
        // Check if AuditEvent model exists and has correct fields
        // Assuming it does based on Phase 6 plan "Ensure schema includes... AuditEvent table"
        // And analysis showed it exists.
        await tx.auditEvent.createMany({
          data: events.map((e) => ({
            orderId,
            action: e.action,
            actorId: e.actorId,
            payload: e.payload ?? {},
            createdAt: new Date(),
          })),
        });
      }
    });

    return {
      orderId,
      status: newDomain.status,
      nextActionType: triggers.nextActionType,
      nextActionAt: triggers.nextActionAt,
      isUrgent: triggers.isUrgent,
    };
  }
}

export const ordersService = new OrdersService();

// Backward-compatible adapter used by older routes/tests.
export const orderActionService = {
  execute: async ({
    orderId,
    action,
    payload,
    userId,
  }: {
    orderId: string;
    action: OpsActionType;
    payload: ActionPayload;
    userId: string;
  }) => ordersService.executeAction(orderId, action, payload, userId),
};
