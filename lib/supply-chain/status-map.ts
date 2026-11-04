import { OrderStatus } from '@prisma/client';
import { mapLegacyStatusToOrderStatus } from '@/domain/status/legacyStatusMap';
import { ORDERED_STAGES, SupplyStage } from '@/lib/supply-chain/stages';

export const STAGE_TO_STATUSES: Record<SupplyStage, OrderStatus[]> = {
  [SupplyStage.INTAKE]: [
    OrderStatus.DRAFT,
    OrderStatus.TO_DO,
    OrderStatus.CALL_BACK,
    OrderStatus.PENDING_APPROVAL,
    OrderStatus.CONFIRMED,
    OrderStatus.RECEIVED,
  ],
  [SupplyStage.PROCUREMENT]: [
    OrderStatus.PO_CREATED,
    OrderStatus.AWAITING_STOCK,
    OrderStatus.PROCESSING,
  ],
  [SupplyStage.RECEIVING]: [
    OrderStatus.PARTIALLY_SUPPLIED,
    OrderStatus.READY_FOR_INSTALL,
    OrderStatus.READY,
  ],
  [SupplyStage.SCHEDULING]: [
    OrderStatus.INSTALL_SCHEDULING,
    OrderStatus.SCHEDULED,
    OrderStatus.IN_TRANSIT,
  ],
  [SupplyStage.EXECUTION]: [
    OrderStatus.AWAITING_INSTALL,
    OrderStatus.INSTALLATION,
    OrderStatus.INSTALLED,
  ],
  [SupplyStage.CLOSURE]: [
    OrderStatus.SUPPLIED,
    OrderStatus.INVOICED,
    OrderStatus.COMPLETED,
    OrderStatus.CLOSED,
    OrderStatus.ON_HOLD,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],
};

const STATUS_TO_STAGE: Map<OrderStatus, SupplyStage> = new Map();

(Object.keys(STAGE_TO_STATUSES) as SupplyStage[]).forEach((stage) => {
  STAGE_TO_STATUSES[stage].forEach((status) => {
    STATUS_TO_STAGE.set(status, stage);
  });
});

export function normalizeStatus(statusRaw: string): OrderStatus | null {
  if (!statusRaw) return null;

  try {
    return mapLegacyStatusToOrderStatus(statusRaw);
  } catch {
    return null;
  }
}

export function getStageFromStatus(statusRaw: string | OrderStatus): SupplyStage {
  const status =
    typeof statusRaw === 'string' ? normalizeStatus(statusRaw) : mapLegacyStatusToOrderStatus(statusRaw);

  if (!status) {
    return SupplyStage.INTAKE;
  }

  return STATUS_TO_STAGE.get(status) ?? SupplyStage.INTAKE;
}

export function getStatusesForStage(stage: SupplyStage): OrderStatus[] {
  return STAGE_TO_STATUSES[stage] || [];
}

export function getNextStage(currentStage: SupplyStage): SupplyStage {
  const index = ORDERED_STAGES.indexOf(currentStage);
  if (index < 0) {
    return SupplyStage.INTAKE;
  }

  return ORDERED_STAGES[Math.min(index + 1, ORDERED_STAGES.length - 1)] ?? SupplyStage.CLOSURE;
}
