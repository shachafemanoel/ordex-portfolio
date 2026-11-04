import type { OrderItem, OrderStatus } from '@prisma/client';
import { normalizeOrderStatus } from '@/lib/orderStatus';

export interface ReceivingProgressResult {
  newStatus?: OrderStatus;
  triggeredActions: string[];
}

export function evaluateReceivingProgress(
  items: Array<Pick<OrderItem, 'qty' | 'received' | 'receivedQuantity'>>,
  currentStatus: OrderStatus
): ReceivingProgressResult {
  const normalizedCurrent = normalizeOrderStatus(currentStatus);
  const receivingStatuses = new Set<OrderStatus>([
    'AWAITING_STOCK',
    'PARTIALLY_SUPPLIED',
    'PO_CREATED',
    'READY_FOR_INSTALL',
  ]);
  const postSchedulingStatuses = new Set<OrderStatus>(['SCHEDULED', 'COMPLETED']);

  const totalItems = items.length;
  const fullyReceivedItems = items.filter((item) => item.received || (item.receivedQuantity ?? 0) >= item.qty).length;
  const partiallyReceivedItems = items.filter(
    (item) => !item.received && (item.receivedQuantity ?? 0) > 0
  ).length;

  const triggeredActions: string[] = [];
  let newStatus: OrderStatus | undefined;

  if (totalItems === 0) {
    return { triggeredActions };
  }

  if (fullyReceivedItems === totalItems) {
    if (receivingStatuses.has(normalizedCurrent)) {
      newStatus = 'READY_FOR_INSTALL';
      triggeredActions.push('ALL_ITEMS_RECEIVED', 'READY_FOR_SCHEDULING');
    } else if (postSchedulingStatuses.has(normalizedCurrent)) {
      // Keep scheduled/completed orders on their current track but still emit action hooks
      triggeredActions.push('ALL_ITEMS_RECEIVED');
    }
  } else if (partiallyReceivedItems > 0 || fullyReceivedItems > 0) {
    if (receivingStatuses.has(normalizedCurrent)) {
      newStatus = 'PARTIALLY_SUPPLIED';
      triggeredActions.push('PARTIAL_RECEIVING_STARTED');
    }
  } else if (normalizedCurrent === 'PO_CREATED') {
    newStatus = 'AWAITING_STOCK';
  }

  if (newStatus === normalizedCurrent) {
    newStatus = undefined;
  }

  return { newStatus, triggeredActions };
}
