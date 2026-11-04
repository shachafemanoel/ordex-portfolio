export type OpsLane = 'READY' | 'WAITING' | 'NEEDS_ACTION' | 'SCHEDULED';

export interface PrioritySortInput {
  urgent: boolean;
  lane: OpsLane | string;
  snoozeUntil: Date | null;
  lastActionAt: Date | null;
  createdAt: Date;
}

/**
 * Compute a numeric priority score for board sorting.
 * Higher scores should appear first.
 */
export function computePriorityScore(input: PrioritySortInput): number {
  const now = new Date();
  let score = 0;

  if (input.urgent) score += 1000;

  // Overdue snooze: higher penalty after 24h.
  if (input.snoozeUntil && input.snoozeUntil < now) {
    const overdueMs = now.getTime() - input.snoozeUntil.getTime();
    score += overdueMs > 24 * 60 * 60 * 1000 ? 500 : 300;
  }

  switch (input.lane) {
    case 'NEEDS_ACTION':
      score += 100;
      break;
    case 'WAITING':
      score += 0;
      break;
    case 'SCHEDULED':
      score += 50;
      break;
    case 'READY':
      score -= 100;
      break;
  }

  return score;
}
