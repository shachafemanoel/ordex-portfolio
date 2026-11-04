import { OrderDomain } from '@/src/server/domain/orders/model';
import { ActionPayload, ActionContext, ActionResult } from '@/src/server/domain/orders/actions';
import { OrderStatus, OrderItem, AllocationStatus } from '@prisma/client';
import { resolveCurrentQueue } from '@/src/server/domain/orders/actions/helpers';

export const completeAction = (
  order: OrderDomain,
  payload: ActionPayload,
  ctx: ActionContext
): ActionResult => {
  const { now, userId } = ctx;
  const currentQueue = resolveCurrentQueue(order);

  const mutatedOrder = { ...order };
  let mutatedItems: OrderItem[] = [];

  switch (currentQueue) {
    case 'PREP':
    case 'NEED_PO': {
      // Complete preparation -> move to awaiting stock
      const etaDays = payload.estimatedDays ?? 3;
      const estimatedDate = new Date(now);
      estimatedDate.setDate(estimatedDate.getDate() + etaDays);

      mutatedItems = order.items.map(item => {
        if (item.receivedQuantity >= item.qty) return item;
        return {
          ...item,
          sentToSupplierAt: now,
          estimatedSupplyAt: estimatedDate,
          allocationStatus: 'ON_ORDER' as AllocationStatus,
        };
      });

      mutatedOrder.status = OrderStatus.AWAITING_STOCK;
      mutatedOrder.scheduledAt = estimatedDate;
      mutatedOrder.lastActionAt = now;
      mutatedOrder.opsLane = 'WAITING';
      mutatedOrder.workingByUserId = null;
      mutatedOrder.workingStartedAt = null;
      break;
    }

    case 'NEED_RECEIPT': {
      // Goods received -> install scheduling
      mutatedItems = order.items.map(item => {
        if (item.receivedQuantity >= item.qty) return item;
        return {
          ...item,
          receivedQuantity: item.qty,
        };
      });

      mutatedOrder.status = OrderStatus.INSTALL_SCHEDULING;
      mutatedOrder.lastActionAt = now;
      mutatedOrder.opsLane = 'NEEDS_ACTION';
      mutatedOrder.workingByUserId = null;
      mutatedOrder.workingStartedAt = null;
      break;
    }

    case 'NEED_CUSTOMER': {
      // Customer contacted -> back to processing
      mutatedOrder.status = OrderStatus.PROCESSING;
      mutatedOrder.lastActionAt = now;
      mutatedOrder.opsLane = 'NEEDS_ACTION';
      mutatedOrder.opsSnoozeUntil = null;
      mutatedOrder.opsSnoozeReason = null;
      mutatedOrder.workingByUserId = null;
      mutatedOrder.workingStartedAt = null;
      break;
    }

    case 'NEED_DELIVERY_SCHED': {
      // Delivery scheduled -> awaiting install/delivery
      const deliveryDate = payload.estimatedDeliveryAt
        ? new Date(payload.estimatedDeliveryAt)
        : order.scheduledAt ?? now;

      mutatedOrder.status = OrderStatus.AWAITING_INSTALL;
      mutatedOrder.scheduledAt = deliveryDate;
      mutatedOrder.lastActionAt = now;
      mutatedOrder.opsLane = 'SCHEDULED';
      mutatedOrder.workingByUserId = null;
      mutatedOrder.workingStartedAt = null;
      break;
    }

    case 'TO_PICK': {
      // Items picked -> out for delivery
      mutatedOrder.status = OrderStatus.IN_TRANSIT;
      mutatedOrder.lastActionAt = now;
      mutatedOrder.opsLane = 'NEEDS_ACTION';
      mutatedOrder.workingByUserId = null;
      mutatedOrder.workingStartedAt = null;
      break;
    }

    case 'OUT_FOR_DELIVERY': {
      // Delivered -> completed
      mutatedOrder.status = OrderStatus.COMPLETED;
      mutatedOrder.completedAt = now;
      mutatedOrder.lastActionAt = now;
      mutatedOrder.opsLane = null;
      mutatedOrder.workingByUserId = null;
      mutatedOrder.workingStartedAt = null;
      break;
    }

    default: {
      // Generic completion
      mutatedOrder.lastActionAt = now;
      mutatedOrder.workingByUserId = null;
      mutatedOrder.workingStartedAt = null;
      break;
    }
  }

  return {
    mutatedOrder,
    mutatedItems: mutatedItems.length > 0 ? mutatedItems : undefined,
    events: [
      {
        action: 'COMPLETE',
        actorId: userId,
        orderId: order.id,
        payload: { queue: currentQueue, ...payload },
      },
    ],
  };
};
