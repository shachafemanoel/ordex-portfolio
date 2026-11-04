import { OrderStatus } from '@prisma/client';

export interface TransitionResult {
  status: OrderStatus;
  lane: string | null;
  resetWorker: boolean;
}

export function getCompleteTransition(queue: string, currentStatus: OrderStatus): TransitionResult {
  switch (queue) {
    case 'PREP':
    case 'NEED_PO':
      return { status: OrderStatus.AWAITING_STOCK, lane: 'WAITING', resetWorker: true };
    case 'NEED_RECEIPT':
      return { status: OrderStatus.INSTALL_SCHEDULING, lane: 'NEEDS_ACTION', resetWorker: true };
    case 'NEED_CUSTOMER':
      return { status: OrderStatus.PROCESSING, lane: 'NEEDS_ACTION', resetWorker: true };
    case 'NEED_DELIVERY_SCHED':
      return { status: OrderStatus.AWAITING_INSTALL, lane: 'SCHEDULED', resetWorker: true };
    case 'TO_PICK':
      return { status: OrderStatus.IN_TRANSIT, lane: 'NEEDS_ACTION', resetWorker: true };
    case 'OUT_FOR_DELIVERY':
      return { status: OrderStatus.COMPLETED, lane: null, resetWorker: true };
    default:
      return { status: currentStatus, lane: null, resetWorker: true }; // No status change, just reset worker
  }
}
