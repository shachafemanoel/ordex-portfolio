import { OrderStatus } from '@prisma/client';

export const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
  // Already-canonical values
  DRAFT: OrderStatus.DRAFT,
  PENDING_APPROVAL: OrderStatus.PENDING_APPROVAL,
  CONFIRMED: OrderStatus.CONFIRMED,
  READY_FOR_INSTALL: OrderStatus.READY_FOR_INSTALL,
  SCHEDULED: OrderStatus.SCHEDULED,
  INVOICED: OrderStatus.INVOICED,
  COMPLETED: OrderStatus.COMPLETED,
  CANCELLED: OrderStatus.CANCELLED,
  TO_DO: OrderStatus.TO_DO,
  CALL_BACK: OrderStatus.CALL_BACK,
  PO_CREATED: OrderStatus.PO_CREATED,
  AWAITING_STOCK: OrderStatus.AWAITING_STOCK,
  PARTIALLY_SUPPLIED: OrderStatus.PARTIALLY_SUPPLIED,
  INSTALL_SCHEDULING: OrderStatus.INSTALL_SCHEDULING,
  AWAITING_INSTALL: OrderStatus.AWAITING_INSTALL,
  SUPPLIED: OrderStatus.SUPPLIED,
  RECEIVED: OrderStatus.RECEIVED,
  PROCESSING: OrderStatus.PROCESSING,
  READY: OrderStatus.READY,
  IN_TRANSIT: OrderStatus.IN_TRANSIT,
  INSTALLATION: OrderStatus.INSTALLATION,
  INSTALLED: OrderStatus.INSTALLED,
  CLOSED: OrderStatus.CLOSED,
  ON_HOLD: OrderStatus.ON_HOLD,
  REFUNDED: OrderStatus.REFUNDED,

  // Legacy aliases
  NEW: OrderStatus.TO_DO,
  WAITING_GOODS: OrderStatus.AWAITING_STOCK,
  WAITING_FOR_STOCK: OrderStatus.AWAITING_STOCK,
  TODO_PROCESSING: OrderStatus.TO_DO,
  CALLBACK_CUSTOMER: OrderStatus.CALL_BACK,
};

const DEPRECATED_LEGACY_STATUSES = new Set<string>([]);

export function mapLegacyStatusToOrderStatus(rawStatus: string | null | undefined): OrderStatus {
  if (!rawStatus) {
    return OrderStatus.DRAFT;
  }

  const normalized = rawStatus.toUpperCase().trim();
  const mapped = LEGACY_STATUS_MAP[normalized];

  if (mapped) {
    return mapped;
  }

  if (DEPRECATED_LEGACY_STATUSES.has(normalized)) {
    return OrderStatus.DRAFT;
  }

  throw new Error(`Unknown legacy order status: ${rawStatus}`);
}
