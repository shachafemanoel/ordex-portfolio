import { ActionError } from '@/src/server/domain/orders/actions/error';
import { OrderDomain } from '@/src/server/domain/orders/model';
import { ActionPayload, ActionContext, ActionResult } from '@/src/server/domain/orders/actions';
import { DeferReason } from '@/src/server/domain/orders/dto'; // Reuse type or define locally
import { buildOrderSnapshot } from '@/lib/orders/rules/orderSnapshot';
import { computeDrillState } from '@/src/server/domain/orders/policies/reconcile';

export const deferAction = (
  order: OrderDomain,
  payload: ActionPayload,
  ctx: ActionContext
): ActionResult => {
  const { now, userId } = ctx;
  const reason = payload.reason as DeferReason | undefined;

  if (!reason) {
    throw new ActionError('Defer requires a reason');
  }

  let snoozeUntil: Date;
  let newOpsLane = 'WAITING';

  switch (reason) {
    case 'WAITING_CUSTOMER':
    case 'MISSING_DETAILS':
      snoozeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h
      break;
    case 'WAITING_SUPPLIER':
      snoozeUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000); // +48h
      break;
    case 'SCHEDULING':
      if (payload.until) {
        snoozeUntil = new Date(payload.until);
        if (isNaN(snoozeUntil.getTime())) {
          throw new ActionError('Invalid "until" date');
        }
      } else {
        snoozeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // default +24h
      }
      newOpsLane = 'SCHEDULED';
      break;
    default:
      snoozeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  // Need to compute drill state to update opsCurrentTask
  // Cast OrderDomain to any to bypass strict type check for now if buildOrderSnapshot is picky
  // But ideally map properly.
  const snapshot = buildOrderSnapshot(order as any);

  const drillState = computeDrillState({
    snapshot,
    opsChecklistState: order.opsChecklistState as any,
    opsSnoozeUntil: snoozeUntil,
    opsSnoozeReason: reason,
  });

  const mutatedOrder = {
    ...order,
    opsSnoozeUntil: snoozeUntil,
    opsSnoozeReason: reason,
    opsLane: newOpsLane,
    opsCurrentTask: drillState.currentTask.taskLabel,
    lastActionAt: now,
    workingByUserId: null,
    workingStartedAt: null,
  };

  return {
    mutatedOrder,
    events: [
      {
        action: 'DEFER',
        actorId: userId,
        orderId: order.id,
        payload: { reason, until: snoozeUntil.toISOString() },
      },
    ],
  };
};
