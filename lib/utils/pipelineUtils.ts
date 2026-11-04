/**
 * Supply Chain Pipeline Utilities
 *
 * Helper functions for creating pipeline stage data from order status counts.
 * This file is used by server components, so it must NOT have 'use client'.
 */

export interface PipelineStage {
  id: string;
  name: string;
  icon: string;
  count: number;
  percentage: number;
  status: 'green' | 'yellow' | 'red';
  filterParam?: string;
}

/**
 * Create pipeline stages from status counts
 */
export function createPipelineStages(statusCounts: Record<string, number>): {
  stages: PipelineStage[];
  total: number;
} {
  const intake = (statusCounts['TO_DO'] || 0) + (statusCounts['CALL_BACK'] || 0);
  const purchase =
    (statusCounts['PO_CREATED'] || 0) +
    (statusCounts['AWAITING_STOCK'] || 0) +
    (statusCounts['PARTIALLY_SUPPLIED'] || 0);
  const install =
    (statusCounts['READY_FOR_INSTALL'] || 0) +
    (statusCounts['SCHEDULED'] || 0) +
    (statusCounts['AWAITING_INSTALL'] || 0);
  const delivered =
    (statusCounts['SUPPLIED'] || 0) +
    (statusCounts['COMPLETED'] || 0) +
    (statusCounts['INVOICED'] || 0);

  const total = intake + purchase + install + delivered;

  const getStatus = (count: number, threshold: number): 'green' | 'yellow' | 'red' => {
    if (count === 0) return 'green';
    if (count > threshold) return 'red';
    return 'yellow';
  };

  return {
    stages: [
      {
        id: 'intake',
        name: 'קליטה/מכירות',
        icon: '📥',
        count: intake,
        percentage: total > 0 ? Math.round((intake / total) * 100) : 0,
        status: getStatus(intake, 10),
        filterParam: 'TO_DO,CALL_BACK',
      },
      {
        id: 'purchase',
        name: 'רכש/ייצור',
        icon: '📦',
        count: purchase,
        percentage: total > 0 ? Math.round((purchase / total) * 100) : 0,
        status: getStatus(purchase, 15),
        filterParam: 'PO_CREATED,AWAITING_STOCK,PARTIALLY_SUPPLIED',
      },
      {
        id: 'install',
        name: 'התקנה',
        icon: '🔧',
        count: install,
        percentage: total > 0 ? Math.round((install / total) * 100) : 0,
        status: getStatus(install, 5),
        filterParam: 'READY_FOR_INSTALL,SCHEDULED,AWAITING_INSTALL',
      },
      {
        id: 'delivered',
        name: 'סופק',
        icon: '✅',
        count: delivered,
        percentage: total > 0 ? Math.round((delivered / total) * 100) : 0,
        status: 'green',
        filterParam: 'SUPPLIED,COMPLETED,INVOICED',
      },
    ],
    total,
  };
}
