import { OrderDomain } from '@/src/server/domain/orders/model';
import type { ActionPayload, OpsActionType } from '@/src/server/domain/orders/dto';
import { OrderItem } from '@prisma/client';

export type { ActionPayload } from '@/src/server/domain/orders/dto';

export interface ActionContext {
  userId: string;
  now: Date;
}

export interface ActionResult {
  mutatedOrder: OrderDomain;
  mutatedItems?: OrderItem[];
  events?: any[]; // Audit events
}

export type OrderActionHandler = (
  order: OrderDomain,
  payload: ActionPayload,
  context: ActionContext
) => Promise<ActionResult> | ActionResult;

import { startAction } from '@/src/server/domain/orders/actions/start';
import { completeAction } from '@/src/server/domain/orders/actions/complete';
import { deferAction } from '@/src/server/domain/orders/actions/defer';
import { splitAction } from '@/src/server/domain/orders/actions/split';
import { cancelAction } from '@/src/server/domain/orders/actions/cancel';
import { markPickedAction } from '@/src/server/domain/orders/actions/markPicked';
import { markDeliveredAction } from '@/src/server/domain/orders/actions/markDelivered';
import { setCustomerWaitAction } from '@/src/server/domain/orders/actions/setCustomerWait';

export const OrderActionRegistry: Record<OpsActionType, OrderActionHandler> = {
  START: startAction,
  COMPLETE: completeAction,
  DEFER: deferAction,
  SPLIT: splitAction,
  CANCEL: cancelAction,
  MARK_PICKED: markPickedAction,
  MARK_DELIVERED: markDeliveredAction,
  SET_CUSTOMER_WAIT: setCustomerWaitAction,
};
