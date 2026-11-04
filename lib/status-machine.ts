import { OrderStatus } from '@prisma/client';
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_TRANSITIONS,
  getStatusLabel,
  normalizeOrderStatus,
} from './orderStatus';

export const ALLOWED_STATUSES: OrderStatus[] = [...ORDER_STATUS_FLOW];

const STATUS_DESCRIPTIONS: Partial<Record<OrderStatus, string>> = {
  RECEIVED: 'התקבל - הזמנה חדשה נקלטה במערכת',
  PROCESSING: 'בטיפול - הזמנה בטיפול (רכש, ליקוט, הכנה)',
  READY: 'מוכן להתקנה - ההזמנה מוכנה ליציאה או התקנה',
  IN_TRANSIT: 'בדרך - ההזמנה בדרך ללקוח',
  INSTALLATION: 'בהתקנה - ההזמנה בתהליך התקנה אצל הלקוח',
  COMPLETED: 'הושלם - ההזמנה סופקה והסתיימה בהצלחה',
  // Legacy statuses
  DRAFT: 'טיוטה - הזמנה חדשה שטרם אושרה',
  TO_DO: 'לטיפול - הזמנה שדורשת פעולה',
  CALL_BACK: 'חזרה ללקוח - ממתין לתגובה מהלקוח',
  PENDING_APPROVAL: 'ממתין לאישור - הזמנה שדורשת אישור',
  CONFIRMED: 'אושר - הזמנה אושרה',
  PO_CREATED: 'נוצרה הזמנת רכש - הזמנת רכש הופקה',
  AWAITING_STOCK: 'ממתין למלאי - ממתין לקבלת סחורה',
  PARTIALLY_SUPPLIED: 'סופק חלקית - חלק מהפריטים התקבלו',
  READY_FOR_INSTALL: 'מוכן להתקנה - כל הפריטים התקבלו, מוכן להתקנה',
  INSTALL_SCHEDULING: 'תיאום התקנה - בתהליך תיאום מועד התקנה',
  SCHEDULED: 'מתוזמן - מועד התקנה נקבע',
  AWAITING_INSTALL: 'ממתין להתקנה - מחכה ליום ההתקנה',
  INSTALLED: 'הותקן - ההתקנה הושלמה',
  SUPPLIED: 'סופק - ההזמנה סופקה ללקוח',
  INVOICED: 'חשבונית - חשבונית הופקה',
  CLOSED: 'נסגר - ההזמנה נסגרה',
  CANCELLED: 'בוטל - ההזמנה בוטלה',
  ON_HOLD: 'מושהה - ההזמנה מושהית זמנית',
  REFUNDED: 'הוחזר - בוצע החזר כספי',
};

const STATUS_PROGRESS: Partial<Record<OrderStatus, number>> = {
  RECEIVED: 10,
  PROCESSING: 30,
  READY: 60,
  IN_TRANSIT: 70,
  INSTALLATION: 80,
  COMPLETED: 100,
  // Legacy statuses with progress values
  DRAFT: 0,
  TO_DO: 5,
  CALL_BACK: 10,
  PENDING_APPROVAL: 5,
  CONFIRMED: 10,
  PO_CREATED: 20,
  AWAITING_STOCK: 30,
  PARTIALLY_SUPPLIED: 45,
  READY_FOR_INSTALL: 60,
  INSTALL_SCHEDULING: 65,
  SCHEDULED: 70,
  AWAITING_INSTALL: 75,
  INSTALLED: 90,
  SUPPLIED: 95,
  INVOICED: 98,
  CLOSED: 100,
  CANCELLED: 0,
  ON_HOLD: 0,
  REFUNDED: 0,
};

export function getAllowedStatuses(): OrderStatus[] {
  return [...ALLOWED_STATUSES];
}

export function getValidTransitions(status: OrderStatus): OrderStatus[] {
  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_TRANSITIONS[normalized] ?? [];
}

export interface ValidationResult {
  allowed: boolean;
  isValid: boolean;
  allowedTargets: OrderStatus[];
  reason?: string;
}

export function validateTransition(from: OrderStatus, to: OrderStatus): ValidationResult {
  const normalizedFrom = normalizeOrderStatus(from);
  const normalizedTo = normalizeOrderStatus(to);

  // Terminal statuses cannot transition
  if (TERMINAL_STATUSES.has(normalizedFrom)) {
    return {
      allowed: false,
      isValid: false,
      allowedTargets: [],
      reason: `${normalizedFrom} is a terminal status and cannot transition`,
    };
  }

  const allowedTargets = getValidTransitions(normalizedFrom);
  const isValid = normalizedFrom === normalizedTo || allowedTargets.includes(normalizedTo);

  return {
    allowed: isValid,
    isValid,
    allowedTargets,
    reason: isValid ? undefined : `Invalid transition from ${normalizedFrom} to ${normalizedTo}`,
  };
}

export function isValidStatus(status: OrderStatus): boolean {
  return ALLOWED_STATUSES.includes(normalizeOrderStatus(status));
}

export function getStatusDisplayName(status: OrderStatus): string {
  return getStatusLabel(status as OrderStatus);
}

export function getStatusDescription(status: OrderStatus): string {
  // Check raw status first (legacy statuses have their own descriptions)
  if (status in STATUS_DESCRIPTIONS) {
    return STATUS_DESCRIPTIONS[status] ?? 'Unknown status';
  }
  const normalized = normalizeOrderStatus(status);
  return STATUS_DESCRIPTIONS[normalized] ?? 'Unknown status';
}

const TERMINAL_STATUSES: Set<OrderStatus> = new Set([
  'COMPLETED',
  'CANCELLED',
  'CLOSED',
  'REFUNDED',
]);

export function isTerminalStatus(status: OrderStatus): boolean {
  const normalized = normalizeOrderStatus(status);
  return TERMINAL_STATUSES.has(normalized);
}

export function getStatusProgress(status: OrderStatus): number {
  // Check the raw status first (for legacy statuses with their own progress)
  if (status in STATUS_PROGRESS) {
    return STATUS_PROGRESS[status] ?? 0;
  }
  const normalized = normalizeOrderStatus(status);
  return STATUS_PROGRESS[normalized] ?? 0;
}

export function createStatusAuditEntry(
  orderId: string,
  previousStatus: OrderStatus,
  newStatus: OrderStatus,
  changedBy: string,
  reason?: string
) {
  return {
    orderId,
    previousStatus: normalizeOrderStatus(previousStatus),
    newStatus: normalizeOrderStatus(newStatus),
    changedBy,
    reason,
    changedAt: new Date(),
  };
}
