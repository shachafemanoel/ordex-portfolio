import type { PurchaseOrderStatus as PrismaPurchaseOrderStatus } from '@prisma/client';

export type PurchaseOrderWorkflowStatus = 'OPEN' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED';
export type PurchaseOrderStatus = PurchaseOrderWorkflowStatus;

const APP_TO_PRISMA_STATUS_MAP: Record<PurchaseOrderWorkflowStatus, PrismaPurchaseOrderStatus> = {
  OPEN: 'SENT',
  PARTIAL: 'PARTIALLY_RECEIVED',
  COMPLETE: 'RECEIVED',
  CANCELLED: 'CANCELLED',
};

const PRISMA_TO_APP_STATUS_MAP: Record<PrismaPurchaseOrderStatus, PurchaseOrderWorkflowStatus> = {
  DRAFT: 'OPEN',
  SENT: 'OPEN',
  PARTIALLY_RECEIVED: 'PARTIAL',
  RECEIVED: 'COMPLETE',
  CANCELLED: 'CANCELLED',
};

export function toPrismaPurchaseOrderStatus(status: PurchaseOrderWorkflowStatus): PrismaPurchaseOrderStatus {
  return APP_TO_PRISMA_STATUS_MAP[status];
}

export function fromPrismaPurchaseOrderStatus(
  status: PrismaPurchaseOrderStatus | null | undefined
): PurchaseOrderWorkflowStatus {
  if (!status) {
    return 'OPEN';
  }
  return PRISMA_TO_APP_STATUS_MAP[status];
}

export function mapStatusesToPrisma(
  statuses?: PurchaseOrderWorkflowStatus[]
): PrismaPurchaseOrderStatus[] | undefined {
  if (!statuses || statuses.length === 0) {
    return undefined;
  }
  return statuses.map((status) => APP_TO_PRISMA_STATUS_MAP[status]);
}

export function parsePurchaseOrderStatus(value?: string | null): PurchaseOrderWorkflowStatus | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === 'OPEN' || normalized === 'PARTIAL' || normalized === 'COMPLETE' || normalized === 'CANCELLED') {
    return normalized;
  }
  return undefined;
}

export function parsePurchaseOrderStatuses(value?: string | null): PurchaseOrderWorkflowStatus[] | undefined {
  if (!value) {
    return undefined;
  }
  const statuses = value
    .split(',')
    .map((part) => parsePurchaseOrderStatus(part))
    .filter((status): status is PurchaseOrderWorkflowStatus => Boolean(status));

  return statuses.length > 0 ? statuses : undefined;
}

export const PURCHASE_ORDER_STATUS_VALUES: PurchaseOrderWorkflowStatus[] = ['OPEN', 'PARTIAL', 'COMPLETE', 'CANCELLED'];
