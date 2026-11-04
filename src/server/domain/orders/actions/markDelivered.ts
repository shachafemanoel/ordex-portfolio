import { OrderDomain } from '@/src/server/domain/orders/model';
import { ActionPayload, ActionContext, ActionResult } from '@/src/server/domain/orders/actions';
import { OrderStatus } from '@prisma/client';

export const markDeliveredAction = (
  order: OrderDomain,
  payload: ActionPayload,
  ctx: ActionContext
): ActionResult => {
  const { userId, now } = ctx;

  const mutatedOrder = {
    ...order,
    status: OrderStatus.COMPLETED,
    completedAt: now,
    lastActionAt: now,
    opsLane: null,
    workingByUserId: null,
    workingStartedAt: null,
  };

  return {
    mutatedOrder,
    events: [{ action: 'MARK_DELIVERED', actorId: userId, orderId: order.id, payload: {} }],
  };
};
