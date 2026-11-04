/**
 * Ops Triggers Service
 *
 * Deterministic engine that computes derived operational fields after any action:
 * - nextActionType (queue key derived from taskLabel)
 * - nextActionAt   (derived from temporal fields)
 * - isUrgent       (deadline-aware)
 * - daily/future classification
 *
 * This service is pure computation — no DB writes.
 */

import { OrderStatus } from '@prisma/client';
import { DerivedTaskInfo, OrderTaskColor, TimelineStep } from '@/src/server/dto/ops.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DAILY_WINDOW_HOURS = 12;

interface TimelineConfigItem {
  key: string;
  titleHe: string;
  weight: number;
  statuses: OrderStatus[];
}

const TIMELINE_CONFIG: TimelineConfigItem[] = [
  { key: 'NEW', titleHe: 'חדש', weight: 10, statuses: [OrderStatus.RECEIVED, OrderStatus.DRAFT] },
  { key: 'CHECK_ITEMS', titleHe: 'בדיקה', weight: 15, statuses: [OrderStatus.PROCESSING, OrderStatus.TO_DO, OrderStatus.CALL_BACK] },
  { key: 'PREP', titleHe: 'הכנה', weight: 25, statuses: [OrderStatus.PO_CREATED, OrderStatus.AWAITING_STOCK, OrderStatus.PARTIALLY_SUPPLIED] },
  { key: 'READY_TO_SCHEDULE', titleHe: 'תיאום', weight: 15, statuses: [OrderStatus.READY, OrderStatus.READY_FOR_INSTALL, OrderStatus.INSTALL_SCHEDULING] },
  { key: 'SCHEDULED', titleHe: 'מתוזמן', weight: 15, statuses: [OrderStatus.SCHEDULED, OrderStatus.AWAITING_INSTALL] },
  { key: 'SENT', titleHe: 'בדרך/ביצוע', weight: 10, statuses: [OrderStatus.IN_TRANSIT, OrderStatus.INSTALLATION, OrderStatus.INSTALLED] },
  { key: 'COMPLETED', titleHe: 'סיום', weight: 10, statuses: [OrderStatus.COMPLETED, OrderStatus.SUPPLIED, OrderStatus.INVOICED, OrderStatus.CLOSED] },
];

/**
 * Mapping of DB status to short Hebrew labels for chips
 */
export const ORDER_STATUS_UI_MAP: Record<OrderStatus, string> = {
  RECEIVED: 'התקבל',
  PROCESSING: 'בטיפול',
  READY: 'מוכן',
  IN_TRANSIT: 'בדרך',
  INSTALLATION: 'בהתקנה',
  COMPLETED: 'סופק',
  DRAFT: 'טיוטה',
  TO_DO: 'לטיפול',
  CALL_BACK: 'חזרה ללקוח',
  PENDING_APPROVAL: 'ממתין לאישור',
  CONFIRMED: 'אושר',
  PO_CREATED: 'הוזמן רכש',
  AWAITING_STOCK: 'ממתין לסחורה',
  PARTIALLY_SUPPLIED: 'סופק חלקית',
  READY_FOR_INSTALL: 'מוכן להתקנה',
  INSTALL_SCHEDULING: 'תיאום התקנה',
  AWAITING_INSTALL: 'ממתין להתקנה',
  SCHEDULED: 'מתוזמן',
  INSTALLED: 'הותקן',
  SUPPLIED: 'סופק',
  INVOICED: 'חשבונית',
  CLOSED: 'נסגר',
  ON_HOLD: 'בהמתנה',
  CANCELLED: 'בוטל',
  REFUNDED: 'הוחזר',
};

/** Maps TaskLabel values to queue-level action type keys */
export const TASK_TO_NEXT_ACTION_TYPE: Record<string, string> = {
  VERIFY_PAYMENT: 'PREP',
  VERIFY_ORDER: 'PREP',
  VERIFY_STOCK: 'PREP',
  CLOSE_ORDER: 'PREP',
  CREATE_PURCHASE_ORDER: 'NEED_PO',
  ASSIGN_SUPPLIERS: 'NEED_PO',
  WAIT_SUPPLIER_DELIVERY: 'NEED_RECEIPT',
  RECEIVE_GOODS: 'NEED_RECEIPT',
  RECEIVE_GOODS_PARTIAL: 'NEED_RECEIPT',
  CALLBACK_CUSTOMER: 'NEED_CUSTOMER',
  SCHEDULE_INSTALLATION: 'NEED_DELIVERY_SCHED',
  WAIT_INSTALLATION_DAY: 'NEED_DELIVERY_SCHED',
};

/** Maps OrderStatus values to shipment queue keys */
export const STATUS_TO_SHIPMENT_ACTION: Record<string, string> = {
  READY_FOR_INSTALL: 'TO_PICK',
  INSTALL_SCHEDULING: 'TO_PICK',
  AWAITING_INSTALL: 'TO_PICK',
  SCHEDULED: 'TO_PICK',
  SUPPLIED: 'TO_PICK',
  READY: 'TO_PICK',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  INSTALLATION: 'OUT_FOR_DELIVERY',
};

/** Terminal statuses — nextActionType = null */
const TERMINAL_STATUSES: string[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.CLOSED,
  OrderStatus.REFUNDED,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriggerInput {
  status: string;
  taskLabel: string | null;
  opsLane: string | null;
  opsSnoozeUntil: Date | null;
  scheduledAt: Date | null;
  urgent: boolean;
  lastActionAt: Date | null;
  createdAt: Date;
  onHold?: boolean;
  items?: any[];
  fulfillmentType?: string;
}

export interface TriggerResult {
  nextActionType: string | null;
  nextActionAt: string | null; // ISO
  isUrgent: boolean;
  isDailyWindow: boolean;
  derivedTask: DerivedTaskInfo;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute derived fields after an action or state change.
 * Pure function — no side effects.
 */
export function computeTriggers(input: TriggerInput): TriggerResult {
  const now = new Date();

  // Derive task info using the new 3-color system
  const derivedTask = deriveOrderTask(input);

  // Terminal status → no next action
  if (TERMINAL_STATUSES.includes(input.status)) {
    return {
      nextActionType: null,
      nextActionAt: null,
      isUrgent: false,
      isDailyWindow: false,
      derivedTask,
    };
  }

  // Derive nextActionType
  const nextActionType = resolveNextActionType(input);

  // Derive nextActionAt
  const nextActionAt = resolveNextActionAt(input, now);

  // Urgency: urgent flag OR nextActionAt is in the past
  const isUrgent = computeUrgency(input.urgent, nextActionAt, now);

  // Daily window classification
  const isDailyWindow = computeDailyWindow(input, nextActionAt, isUrgent, now);

  return {
    nextActionType,
    nextActionAt: nextActionAt?.toISOString() ?? null,
    isUrgent,
    isDailyWindow,
    derivedTask,
  };
}

/**
 * Apply urgency side-effects to an order update payload.
 * Returns the fields that should be persisted after triggers fire.
 */
export function buildTriggerUpdates(
  input: TriggerInput,
): { urgent: boolean } {
  const now = new Date();
  const nextActionAt = resolveNextActionAt(input, now);
  const isUrgent = computeUrgency(input.urgent, nextActionAt, now);

  return { urgent: isUrgent };
}

/**
 * Rule engine to derive the current task context for an order.
 * Follows a strict priority system:
 * 1. GRAY (Blocked/Hold)
 * 2. ORANGE (Preparation/PO/Stock)
 * 3. BLUE (Active/Action needed)
 */
export function deriveOrderTask(input: Partial<TriggerInput>): DerivedTaskInfo {
  const status = (input.status as OrderStatus) || 'RECEIVED';
  const statusLabelHe = ORDER_STATUS_UI_MAP[status] || status;

  // Calculate timeline and progress
  const { timelineSteps, progressPct, currentStepIndex } = calculateTimeline(status, input.onHold || status === 'ON_HOLD');

  const baseInfo = {
    statusLabelHe,
    progressPct,
    timelineSteps,
    isActionableNow: !input.onHold && status !== 'ON_HOLD' && status !== 'CANCELLED' && !TERMINAL_STATUSES.includes(status),
  };

  // --- Priority 1: GRAY (Blocked/Hold) ---
  if (input.onHold || status === 'ON_HOLD') {
    return {
      ...baseInfo,
      taskColor: 'GRAY',
      taskTitleHe: 'בהמתנה',
      primaryAction: { key: 'unhold', labelHe: 'טופל, להחזיר לפעיל' },
      primaryActionHe: 'טופל, להחזיר לפעיל',
      secondaryActionHe: 'עדכון סיבה',
      isActionableNow: false,
    };
  }

  // --- Priority 2: ORANGE (Preparation / PO / Stock) ---
  const hasOpenPO = input.items?.some((i: any) => i.allocationStatus === 'ON_ORDER');
  const isWaitingStock = status === 'AWAITING_STOCK';
  const isPartial = 
    (input.items?.some((i: any) => i.received) && 
     input.items?.some((i: any) => !i.received)) ||
    status === 'PARTIALLY_SUPPLIED';
  
  const inPreparation = 
    ['PO_CREATED', 'AWAITING_STOCK', 'PARTIALLY_SUPPLIED', 'PROCESSING'].includes(status) || 
    !!hasOpenPO || 
    isPartial;

  if (inPreparation) {
    let taskTitleHe = 'בהכנה';
    let primaryAction = { key: 'update-prep', labelHe: 'עדכון מצב הכנה' };

    if (isWaitingStock) {
      taskTitleHe = 'ממתין לסחורה';
      primaryAction = { key: 'receive-goods', labelHe: 'קליטת סחורה' };
    } else if (hasOpenPO || status === 'PO_CREATED') {
      taskTitleHe = 'רכש בתהליך';
      primaryAction = { key: 'view-po', labelHe: 'פרטי רכש' };
    }

    return {
      ...baseInfo,
      taskColor: 'ORANGE',
      taskTitleHe,
      primaryAction,
      primaryActionHe: primaryAction.labelHe,
      secondaryActionHe: 'בעיה',
    };
  }

  // --- Priority 3: BLUE (Active / New Action Needed) ---
  let taskTitleHe = 'לטיפול';
  let primaryAction = { key: 'review', labelHe: 'בדיקת פריטים' };

  if (status === 'RECEIVED' || status === 'DRAFT') {
    taskTitleHe = 'הזמנה חדשה';
    primaryAction = { key: 'accept', labelHe: 'אישור הזמנה' };
  } else if (status === 'CALL_BACK') {
    taskTitleHe = 'לחזור ללקוח';
    primaryAction = { key: 'contact', labelHe: 'יצירת קשר' };
  } else if (['READY', 'READY_FOR_INSTALL', 'INSTALL_SCHEDULING'].includes(status)) {
    taskTitleHe = input.fulfillmentType === 'INSTALLATION' ? 'לתיאום התקנה' : 'לתיאום משלוח';
    primaryAction = { key: 'schedule', labelHe: 'תיאום ביומן' };
  } else if (['IN_TRANSIT', 'INSTALLATION'].includes(status)) {
    taskTitleHe = status === 'IN_TRANSIT' ? 'במשלוח' : 'בהתקנה';
    primaryAction = { key: 'complete', labelHe: 'סיום ביצוע' };
  }

  return {
    ...baseInfo,
    taskColor: 'BLUE',
    taskTitleHe,
    primaryAction,
    primaryActionHe: primaryAction.labelHe,
    secondaryActionHe: 'בעיה',
  };
}

function calculateTimeline(status: OrderStatus, onHold: boolean): { timelineSteps: TimelineStep[], progressPct: number, currentStepIndex: number } {
  let currentStepIndex = -1;
  
  // Find current step index
  for (let i = 0; i < TIMELINE_CONFIG.length; i++) {
    if (TIMELINE_CONFIG[i].statuses.includes(status)) {
      currentStepIndex = i;
      break;
    }
  }

  // Fallback for unknown status: use first step if not terminal, else last
  if (currentStepIndex === -1) {
    if (TERMINAL_STATUSES.includes(status)) {
      currentStepIndex = TIMELINE_CONFIG.length - 1;
    } else {
      currentStepIndex = 0;
    }
  }

  const timelineSteps: TimelineStep[] = TIMELINE_CONFIG.map((step, index) => {
    let state: TimelineStep['state'] = 'upcoming';
    if (index < currentStepIndex) {
      state = 'done';
    } else if (index === currentStepIndex) {
      state = onHold ? 'blocked' : 'active';
    }
    return {
      key: step.key,
      titleHe: step.titleHe,
      state,
    };
  });

  // Calculate progress percentage
  let progressPct = 0;
  for (let i = 0; i < currentStepIndex; i++) {
    progressPct += TIMELINE_CONFIG[i].weight;
  }
  // Add half of the current step's weight for a more "active" feel
  progressPct += TIMELINE_CONFIG[currentStepIndex].weight / 2;

  // Clamp 0-100
  progressPct = Math.min(100, Math.max(0, Math.round(progressPct)));

  return { timelineSteps, progressPct, currentStepIndex };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function resolveNextActionType(input: TriggerInput): string | null {
  // Priority 1: TaskLabel-based mapping (for orders in operational flow)
  if (input.taskLabel) {
    const mapped = TASK_TO_NEXT_ACTION_TYPE[input.taskLabel];
    if (mapped) return mapped;
  }

  // Priority 2: Status-based mapping (for shipments)
  const statusMapped = STATUS_TO_SHIPMENT_ACTION[input.status];
  if (statusMapped) return statusMapped;

  // Fallback for active orders without a clear mapping
  if (!TERMINAL_STATUSES.includes(input.status)) {
    return 'PREP';
  }

  return null;
}

function resolveNextActionAt(input: TriggerInput, now: Date): Date | null {
  // NEEDS_ACTION lane → action needed now
  if (input.opsLane === 'NEEDS_ACTION') {
    return now;
  }

  // Snoozed → wake time
  if (input.opsSnoozeUntil && input.opsSnoozeUntil > now) {
    return input.opsSnoozeUntil;
  }

  // Scheduled → scheduled time
  if (input.scheduledAt) {
    return input.scheduledAt;
  }

  // Default for active orders: now
  return now;
}

function computeUrgency(
  currentUrgent: boolean,
  nextActionAt: Date | null,
  now: Date,
): boolean {
  // Existing urgent flag stays
  if (currentUrgent) return true;

  // Past due → urgent
  if (nextActionAt && nextActionAt <= now) return true;

  return false;
}

function computeDailyWindow(
  input: TriggerInput,
  nextActionAt: Date | null,
  isUrgent: boolean,
  now: Date,
): boolean {
  // Urgent always daily
  if (isUrgent) return true;

  // NEEDS_ACTION always daily
  if (input.opsLane === 'NEEDS_ACTION') return true;

  // Within window
  if (nextActionAt) {
    const windowEdge = new Date(now.getTime() + DAILY_WINDOW_HOURS * 60 * 60 * 1000);
    if (nextActionAt <= windowEdge) return true;
  }

  return false;
}
