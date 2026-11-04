import type { Prisma } from '@prisma/client';

import { acquireOrderMutationLock } from '@/lib/orders/concurrency';
import { getBusinessDayDateKey, shiftZonedDateByDays } from '@/lib/store-business-hours';

export type RebalancedDeliveryOrder = {
  id: string;
  number: string;
  scheduledAt: Date;
  scheduledEnd: Date | null;
  deferredDateKey: string;
};

export async function applyDeferredOrdersToNextBusinessDay(
  tx: Prisma.TransactionClient,
  input: {
    orderIds: string[];
    timezone: string;
  }
): Promise<RebalancedDeliveryOrder[]> {
  const uniqueOrderIds = Array.from(new Set(input.orderIds.filter(Boolean))).sort();
  if (!uniqueOrderIds.length) {
    return [];
  }

  for (const orderId of uniqueOrderIds) {
    await acquireOrderMutationLock(tx, orderId);
  }

  const orders = await tx.order.findMany({
    where: {
      id: {
        in: uniqueOrderIds,
      },
    },
    select: {
      id: true,
      number: true,
      scheduledAt: true,
      scheduledEnd: true,
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
  });

  const rebalancedOrders: RebalancedDeliveryOrder[] = [];

  for (const order of orders) {
    if (!order.scheduledAt) {
      continue;
    }

    const shiftedScheduledAt = shiftZonedDateByDays(order.scheduledAt, input.timezone, 1);
    const shiftedScheduledEnd = order.scheduledEnd
      ? shiftZonedDateByDays(order.scheduledEnd, input.timezone, 1)
      : null;

    await tx.order.update({
      where: { id: order.id },
      data: {
        scheduledAt: shiftedScheduledAt,
        scheduledEnd: shiftedScheduledEnd,
      },
    });

    await tx.installationTask.updateMany({
      where: { orderId: order.id },
      data: {
        scheduledDate: shiftedScheduledAt,
      },
    });

    rebalancedOrders.push({
      id: order.id,
      number: order.number,
      scheduledAt: shiftedScheduledAt,
      scheduledEnd: shiftedScheduledEnd,
      deferredDateKey: getBusinessDayDateKey(shiftedScheduledAt, input.timezone),
    });
  }

  return rebalancedOrders;
}
