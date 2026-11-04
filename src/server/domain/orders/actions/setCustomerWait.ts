import { OrderDomain } from '@/src/server/domain/orders/model';
import { ActionPayload, ActionContext, ActionResult } from '@/src/server/domain/orders/actions';

export const setCustomerWaitAction = (
  order: OrderDomain,
  payload: ActionPayload,
  ctx: ActionContext
): ActionResult => {
  const { userId, now } = ctx;
  const snoozeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

  const mutatedOrder = {
    ...order,
    opsSnoozeUntil: snoozeUntil,
    opsSnoozeReason: 'WAITING_CUSTOMER',
    opsLane: 'WAITING',
    lastActionAt: now,
    workingByUserId: null,
    workingStartedAt: null,
  };

  return {
    mutatedOrder,
    events: [{ action: 'SET_CUSTOMER_WAIT', actorId: userId, orderId: order.id, payload: { until: snoozeUntil.toISOString() } }],
  };
};
