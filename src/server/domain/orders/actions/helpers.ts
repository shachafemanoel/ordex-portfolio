import { OrderDomain } from '@/src/server/domain/orders/model';
import { TASK_TO_NEXT_ACTION_TYPE } from '@/src/server/services/ops-triggers.service';

export function resolveCurrentQueue(order: OrderDomain): string {
  // Try taskLabel mapping first
  if (order.taskLabel) {
    const mapped = TASK_TO_NEXT_ACTION_TYPE[order.taskLabel];
    if (mapped) return mapped;
  }

  // Try status-based mapping for shipments
  const statusMapped: Record<string, string> = {
    READY_FOR_INSTALL: 'TO_PICK',
    INSTALL_SCHEDULING: 'TO_PICK',
    AWAITING_INSTALL: 'TO_PICK',
    SCHEDULED: 'TO_PICK',
    SUPPLIED: 'TO_PICK',
    READY: 'TO_PICK',
    IN_TRANSIT: 'OUT_FOR_DELIVERY',
    INSTALLATION: 'OUT_FOR_DELIVERY',
  };

  return statusMapped[order.status] ?? 'PREP';
}
