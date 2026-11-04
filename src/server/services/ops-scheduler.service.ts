/**
 * Ops Scheduler Service
 *
 * Enforces the Daily Ops window and urgency rules on a schedule.
 * Scans active orders with temporal markers (opsSnoozeUntil, scheduledAt)
 * and flips the `urgent` flag according to the 12h window rule.
 *
 * Designed to be idempotent, batched, and safe to run frequently.
 */

import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAILY_WINDOW_HOURS = 12;
const LOOKAHEAD_HOURS = 72;
const BATCH_SIZE = 200;
const MAX_UPDATES_PER_RUN = 2000;

/** Terminal statuses — excluded from enforcement */
const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.CLOSED,
  OrderStatus.REFUNDED,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchedulerSummary {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  scanned: number;
  updatedUrgentOn: number;
  updatedUrgentOff: number;
  errors: number;
  topErrors: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run one enforcement cycle.
 * Scans active orders and reconciles urgency with the 12h window.
 * Safe to call concurrently (each order update is independent).
 */
export async function enforceOpsWindow(): Promise<SchedulerSummary> {
  const startedAt = new Date();
  const now = startedAt;
  const windowEdge = new Date(now.getTime() + DAILY_WINDOW_HOURS * 60 * 60 * 1000);
  const lookaheadEdge = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);

  const summary: SchedulerSummary = {
    startedAt: startedAt.toISOString(),
    completedAt: '',
    durationMs: 0,
    scanned: 0,
    updatedUrgentOn: 0,
    updatedUrgentOff: 0,
    errors: 0,
    topErrors: [],
  };

  logger.info('[ops-scheduler] Starting enforcement cycle', {
    windowEdge: windowEdge.toISOString(),
    lookaheadEdge: lookaheadEdge.toISOString(),
  });

  let totalUpdates = 0;
  let cursor: string | undefined;

  try {
    // Paginate through candidate orders
    while (totalUpdates < MAX_UPDATES_PER_RUN) {
      const candidates = await fetchCandidateBatch(lookaheadEdge, cursor);

      if (candidates.length === 0) break;

      summary.scanned += candidates.length;
      cursor = candidates[candidates.length - 1].id;

      for (const order of candidates) {
        if (totalUpdates >= MAX_UPDATES_PER_RUN) break;

        try {
          const result = reconcileUrgency(order, now, windowEdge);

          if (result !== null) {
            await prisma.order.update({
              where: { id: order.id },
              data: { urgent: result },
            });

            if (result) {
              summary.updatedUrgentOn++;
            } else {
              summary.updatedUrgentOff++;
            }
            totalUpdates++;
          }
        } catch (err) {
          summary.errors++;
          if (summary.topErrors.length < 5) {
            const msg = err instanceof Error ? err.message : String(err);
            summary.topErrors.push(`order=${order.id}: ${msg}`);
          }
        }
      }

      // If batch was smaller than BATCH_SIZE, we've exhausted candidates
      if (candidates.length < BATCH_SIZE) break;
    }
  } catch (err) {
    logger.error('[ops-scheduler] Fatal error during scan', err);
    summary.errors++;
    if (summary.topErrors.length < 5) {
      summary.topErrors.push(
        `fatal: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const completedAt = new Date();
  summary.completedAt = completedAt.toISOString();
  summary.durationMs = completedAt.getTime() - startedAt.getTime();

  logger.info('[ops-scheduler] Enforcement cycle complete', {
    scanned: summary.scanned,
    updatedOn: summary.updatedUrgentOn,
    updatedOff: summary.updatedUrgentOff,
    errors: summary.errors,
    durationMs: summary.durationMs,
  });

  return summary;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface CandidateOrder {
  id: string;
  urgent: boolean;
  opsLane: string | null;
  opsSnoozeUntil: Date | null;
  scheduledAt: Date | null;
}

/**
 * Fetch a batch of candidate orders that might need urgency reconciliation.
 *
 * Candidates are active (non-terminal) orders that have:
 * - a temporal marker (opsSnoozeUntil or scheduledAt) within lookahead window
 * - OR are currently marked urgent (to evaluate de-escalation)
 */
async function fetchCandidateBatch(
  lookaheadEdge: Date,
  afterCursor?: string,
): Promise<CandidateOrder[]> {
  return prisma.order.findMany({
    where: {
      status: { notIn: TERMINAL_STATUSES },
      deletedAt: null,
      OR: [
        // Orders with snooze expiring within lookahead
        { opsSnoozeUntil: { not: null, lte: lookaheadEdge } },
        // Orders with schedule within lookahead
        { scheduledAt: { not: null, lte: lookaheadEdge } },
        // Currently urgent orders (check for de-escalation)
        { urgent: true },
      ],
      // Cursor-based pagination
      ...(afterCursor ? { id: { gt: afterCursor } } : {}),
    },
    select: {
      id: true,
      urgent: true,
      opsLane: true,
      opsSnoozeUntil: true,
      scheduledAt: true,
    },
    orderBy: { id: 'asc' },
    take: BATCH_SIZE,
  });
}

/**
 * Determine whether an order's urgency should change.
 *
 * Returns:
 * - `true`  if order should become urgent
 * - `false` if order should lose urgency
 * - `null`  if no change needed
 */
function reconcileUrgency(
  order: CandidateOrder,
  now: Date,
  windowEdge: Date,
): boolean | null {
  const nextActionAt = resolveNextActionAt(order, now);
  const shouldBeUrgent = computeDesiredUrgency(nextActionAt, windowEdge);

  if (shouldBeUrgent === order.urgent) return null;
  return shouldBeUrgent;
}

/**
 * Resolve the effective "next action at" timestamp for urgency computation.
 */
function resolveNextActionAt(order: CandidateOrder, now: Date): Date | null {
  // NEEDS_ACTION lane orders need attention now
  if (order.opsLane === 'NEEDS_ACTION') return now;

  // Snoozed: wake time
  if (order.opsSnoozeUntil) return order.opsSnoozeUntil;

  // Scheduled: delivery/install time
  if (order.scheduledAt) return order.scheduledAt;

  // No temporal marker — can't determine urgency from time alone
  return null;
}

/**
 * Compute desired urgency based on 12h window rule.
 *
 * - nextActionAt <= windowEdge (now + 12h) → urgent
 * - nextActionAt > windowEdge → not urgent
 * - no nextActionAt → not urgent (leave as-is via null check in caller)
 */
function computeDesiredUrgency(
  nextActionAt: Date | null,
  windowEdge: Date,
): boolean {
  if (!nextActionAt) return false;
  return nextActionAt <= windowEdge;
}
