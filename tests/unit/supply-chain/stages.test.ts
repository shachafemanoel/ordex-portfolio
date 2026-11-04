import {
  ORDERED_STAGES,
  STAGE_TO_STATUSES,
  SupplyStage,
  getStageFromStatus,
} from '@/lib/supply-chain';
import { OrderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

describe('Supply Chain Stage Mapping', () => {
  it('should map every OrderStatus to a valid SupplyStage', () => {
    const allStatuses = Object.values(OrderStatus);

    allStatuses.forEach((status) => {
      const stage = getStageFromStatus(status);
      expect(ORDERED_STAGES).toContain(stage);
    });
  });

  it('should map specific critical statuses correctly', () => {
    expect(getStageFromStatus('DRAFT')).toBe(SupplyStage.RECEIVED);
    expect(getStageFromStatus('PO_CREATED')).toBe(SupplyStage.PROCESSING);
    expect(getStageFromStatus('PARTIALLY_SUPPLIED')).toBe(SupplyStage.READY);
    expect(getStageFromStatus('INSTALL_SCHEDULING')).toBe(SupplyStage.IN_TRANSIT);
    expect(getStageFromStatus('READY_FOR_INSTALL')).toBe(SupplyStage.READY);
    expect(getStageFromStatus('COMPLETED')).toBe(SupplyStage.COMPLETED);
  });

  it('should handle legacy or case-insensitive inputs', () => {
    expect(getStageFromStatus('draft')).toBe(SupplyStage.RECEIVED);
    expect(getStageFromStatus('pending_approval')).toBe(SupplyStage.RECEIVED);
  });

  it('should fallback to RECEIVED for unknown statuses', () => {
    expect(getStageFromStatus('UNKNOWN_STATUS_XYZ')).toBe(SupplyStage.RECEIVED);
    expect(getStageFromStatus('')).toBe(SupplyStage.RECEIVED);
  });

  it('should ensure all stages have mapped statuses', () => {
    ORDERED_STAGES.forEach((stage) => {
      const statuses = STAGE_TO_STATUSES[stage];
      expect(statuses.length).toBeGreaterThan(0);
    });
  });
});
