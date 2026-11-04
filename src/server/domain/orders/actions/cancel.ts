import { OrderDomain } from '@/src/server/domain/orders/model';
import { ActionPayload, ActionContext, ActionResult } from '@/src/server/domain/orders/actions';
import { OrderStatus } from '@prisma/client';

export const cancelAction = (
  order: OrderDomain,
  payload: ActionPayload,
  ctx: ActionContext
): ActionResult => {
  const { userId, now } = ctx;
  let notesUpdate: string | undefined;
  if (payload.reason) {
    const existing = order.notesInternal ?? '';
    notesUpdate = `${existing}\nCancelled: ${payload.reason}`.trim();
  }

  const mutatedOrder = {
    ...order,
    status: OrderStatus.CANCELLED,
    lastActionAt: now,
    opsLane: null,
    opsSnoozeUntil: null,
    opsSnoozeReason: null,
    workingByUserId: null,
    workingStartedAt: null,
    ...(notesUpdate !== undefined && { notesInternal: notesUpdate }),
  };

  return {
    mutatedOrder,
    events: [{ action: 'CANCEL', actorId: userId, orderId: order.id, payload: { reason: payload.reason } }],
  };
};
