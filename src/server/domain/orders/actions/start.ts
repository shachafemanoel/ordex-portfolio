import { OrderDomain } from '@/src/server/domain/orders/model';
import { ActionPayload, ActionContext, ActionResult } from '@/src/server/domain/orders/actions';

export const startAction = (
  order: OrderDomain,
  payload: ActionPayload,
  ctx: ActionContext
): ActionResult => {
  const { userId, now } = ctx;

  const mutatedOrder = {
    ...order,
    workingByUserId: userId,
    workingStartedAt: now,
    lastActionAt: now,
    opsLane: order.opsLane || 'NEEDS_ACTION',
  };

  return {
    mutatedOrder,
    events: [
      {
        action: 'START',
        actorId: userId,
        orderId: order.id,
        payload: {},
      },
    ],
  };
};
