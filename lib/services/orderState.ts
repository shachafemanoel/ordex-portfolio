import { Order, OrderStatus } from '@prisma/client';
import { mapLegacyStatus, CanonicalStatus } from '@/lib/services/statusMapping';

export interface OrderState {
  canonicalStatus: string;
  isDraft: boolean;
  onHold: boolean;
  inventoryStatus: string;
  completionType: string | null;
  legacyStatus: OrderStatus;
}

export function getOrderState(order: Order): OrderState {
  const useCanonicalRead = process.env.CANONICAL_READ === 'true';

  if (useCanonicalRead && order.statusV2) {
    return {
      canonicalStatus: order.statusV2,
      isDraft: order.isDraft,
      onHold: order.onHold,
      inventoryStatus: order.inventoryStatus,
      completionType: order.completionType,
      legacyStatus: order.status,
    };
  }

  // Fallback to mapping
  const mapped = mapLegacyStatus(order.status);
  return {
    canonicalStatus: mapped.statusV2,
    isDraft: mapped.isDraft,
    onHold: mapped.onHold,
    inventoryStatus: mapped.inventoryStatus,
    completionType: mapped.completionType,
    legacyStatus: order.status,
  };
}
