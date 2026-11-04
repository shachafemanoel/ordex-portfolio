import { normalizeOrderStatus } from '@/lib/orderStatus';
import { OrderStatus } from '@prisma/client';

export type CanonicalStatus = OrderStatus;

export interface LegacyStatusMapping {
  statusV2: CanonicalStatus;
  isDraft: boolean;
  onHold: boolean;
  inventoryStatus: 'NONE' | 'PENDING' | 'PARTIAL' | 'AVAILABLE';
  completionType: 'COMPLETE' | 'CANCELLED' | null;
}

function toInventoryStatus(status: OrderStatus): LegacyStatusMapping['inventoryStatus'] {
  switch (status) {
    case OrderStatus.PO_CREATED:
    case OrderStatus.AWAITING_STOCK:
    case OrderStatus.PROCESSING:
      return 'PENDING';
    case OrderStatus.PARTIALLY_SUPPLIED:
      return 'PARTIAL';
    case OrderStatus.READY:
    case OrderStatus.READY_FOR_INSTALL:
    case OrderStatus.INSTALL_SCHEDULING:
    case OrderStatus.AWAITING_INSTALL:
    case OrderStatus.SCHEDULED:
    case OrderStatus.IN_TRANSIT:
    case OrderStatus.INSTALLATION:
    case OrderStatus.INSTALLED:
    case OrderStatus.SUPPLIED:
    case OrderStatus.INVOICED:
    case OrderStatus.CLOSED:
    case OrderStatus.COMPLETED:
      return 'AVAILABLE';
    default:
      return 'NONE';
  }
}

function toCompletionType(status: OrderStatus): LegacyStatusMapping['completionType'] {
  switch (status) {
    case OrderStatus.CANCELLED:
    case OrderStatus.REFUNDED:
      return 'CANCELLED';
    case OrderStatus.COMPLETED:
    case OrderStatus.SUPPLIED:
    case OrderStatus.INSTALLED:
    case OrderStatus.INVOICED:
    case OrderStatus.CLOSED:
      return 'COMPLETE';
    default:
      return null;
  }
}

export function mapLegacyStatus(status: string | OrderStatus | null | undefined): LegacyStatusMapping {
  const normalized = normalizeOrderStatus(status);

  return {
    statusV2: normalized,
    isDraft: normalized === OrderStatus.DRAFT,
    onHold: normalized === OrderStatus.ON_HOLD,
    inventoryStatus: toInventoryStatus(normalized),
    completionType: toCompletionType(normalized),
  };
}
