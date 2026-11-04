import { ActionError } from '@/src/server/domain/orders/actions/error';
import { OrderDomain } from '@/src/server/domain/orders/model';
import { ActionPayload, ActionContext, ActionResult } from '@/src/server/domain/orders/actions';
import { OrderStatus, OrderItem } from '@prisma/client';

export const splitAction = (
  order: OrderDomain,
  payload: ActionPayload,
  ctx: ActionContext
): ActionResult => {
  const { userId, now } = ctx;
  if (!payload.items || payload.items.length === 0) {
    throw new ActionError('Split requires items');
  }

  const mutatedItems: OrderItem[] = [];
  const itemsMap = new Map(order.items.map(i => [i.id, i]));

  for (const splitItem of payload.items) {
    // Find item by productId - consistent with legacy logic finding first match
    const item = order.items.find(i => i.productId === splitItem.productId);
    if (item) {
      const newReceived = Math.min(
        item.receivedQuantity + splitItem.qty,
        item.qty
      );
      if (newReceived !== item.receivedQuantity) {
        const mutatedItem = { ...item, receivedQuantity: newReceived };
        mutatedItems.push(mutatedItem);
        itemsMap.set(item.id, mutatedItem);
      }
    }
  }

  const allReceived = Array.from(itemsMap.values()).every(i => i.receivedQuantity >= i.qty);

  const newStatus = allReceived
    ? OrderStatus.INSTALL_SCHEDULING
    : OrderStatus.PARTIALLY_SUPPLIED;

  const mutatedOrder = {
    ...order,
    status: newStatus,
    lastActionAt: now,
    opsLane: allReceived ? 'NEEDS_ACTION' : 'WAITING',
  };

  return {
    mutatedOrder,
    mutatedItems: mutatedItems.length > 0 ? mutatedItems : undefined,
    events: [
      {
        action: 'SPLIT',
        actorId: userId,
        orderId: order.id,
        payload: { items: payload.items },
      },
    ],
  };
};
