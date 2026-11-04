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
 * Helper to create stage data from status counts
 */
export function createPipelineStages(statusCounts: Record<string, number>): {
  stages: PipelineStage[];
  total: number;
} {
  const intake = (statusCounts['RECEIVED'] || 0);
  const purchase = (statusCounts['PROCESSING'] || 0);
  const install =
    (statusCounts['READY'] || 0) +
    (statusCounts['IN_TRANSIT'] || 0) +
    (statusCounts['INSTALLATION'] || 0);
  const delivered = (statusCounts['COMPLETED'] || 0);

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
        filterParam: 'RECEIVED',
      },
      {
        id: 'purchase',
        name: 'רכש/ייצור',
        icon: '📦',
        count: purchase,
        percentage: total > 0 ? Math.round((purchase / total) * 100) : 0,
        status: getStatus(purchase, 15),
        filterParam: 'PROCESSING',
      },
      {
        id: 'install',
        name: 'התקנה',
        icon: '🔧',
        count: install,
        percentage: total > 0 ? Math.round((install / total) * 100) : 0,
        status: getStatus(install, 5),
        filterParam: 'READY,IN_TRANSIT,INSTALLATION',
      },
      {
        id: 'delivered',
        name: 'סופק',
        icon: '✅',
        count: delivered,
        percentage: total > 0 ? Math.round((delivered / total) * 100) : 0,
        status: 'green',
        filterParam: 'COMPLETED',
      },
    ],
    total,
  };
}

/**
 * Generate mock trend data for demo (replace with real data)
 */
export function generateMockTrendData(): { date: string; value: number }[] {
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳'];
  return days.map((date, i) => ({
    date,
    value: 3000 + Math.floor(Math.random() * 2000) + i * 500,
  }));
}
