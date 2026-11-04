import { OrderDomain } from '@/src/server/domain/orders/model';
import { ActionPayload, ActionContext, ActionResult } from '@/src/server/domain/orders/actions';
import { OrderStatus } from '@prisma/client';

export const markPickedAction = (
  order: OrderDomain,
  payload: ActionPayload,
  ctx: ActionContext
): ActionResult => {
  const { userId, now } = ctx;

  const mutatedOrder = {
    ...order,
    status: OrderStatus.IN_TRANSIT,
    lastActionAt: now,
    opsLane: 'NEEDS_ACTION',
    workingByUserId: null,
    workingStartedAt: null,
  };

  return {
    mutatedOrder,
    events: [{ action: 'MARK_PICKED', actorId: userId, orderId: order.id, payload: {} }],
  };
};
