/**
 * Order Status Machine
 * Defines valid transitions, actions, and validation rules
 */

import type { OrderStatus, UserRole } from './types';

// ============================================================================
// ACTION DEFINITIONS
// ============================================================================

export type OrderAction =
  | 'ASSIGN_OWNER'
  | 'START_REVIEW'
  | 'PUT_ON_HOLD'
  | 'APPROVE'
  | 'START_PREPARATION'
  | 'REASSIGN_OWNER'
  | 'MARK_ITEM_PICKED'
  | 'REPORT_MISSING_ITEMS'
  | 'MARK_PREPARATION_COMPLETED'
  | 'ADD_NOTE'
  | 'UPDATE_SHORTAGE'
  | 'RETURN_TO_PREPARATION'
  | 'SCHEDULE_DELIVERY'
  | 'SCHEDULE_INSTALLATION'
  | 'EDIT_SCHEDULE'
  | 'MARK_READY_FOR_DISPATCH'
  | 'DISPATCH'
  | 'MARK_COMPLETED'
  | 'REPORT_DELIVERY_ISSUE'
  | 'RETURN_TO_DISPATCH'
  | 'RESUME'
  | 'UPDATE_HOLD_REASON'
  | 'CANCEL'
  | 'CHANGE_PRIORITY';

export const ACTION_LABELS: Record<OrderAction, string> = {
  ASSIGN_OWNER: 'הקצה אחראי',
  START_REVIEW: 'התחל בדיקה',
  PUT_ON_HOLD: 'העבר להמתנה',
  APPROVE: 'אשר הזמנה',
  START_PREPARATION: 'התחל הכנה',
  REASSIGN_OWNER: 'הקצה מחדש',
  MARK_ITEM_PICKED: 'סמן פריט כנאסף',
  REPORT_MISSING_ITEMS: 'דווח על פריטים חסרים',
  MARK_PREPARATION_COMPLETED: 'סיים הכנה',
  ADD_NOTE: 'הוסף הערה',
  UPDATE_SHORTAGE: 'עדכן חוסרים',
  RETURN_TO_PREPARATION: 'חזור להכנה',
  SCHEDULE_DELIVERY: 'תזמן משלוח',
  SCHEDULE_INSTALLATION: 'תזמן התקנה',
  EDIT_SCHEDULE: 'ערוך תזמון',
  MARK_READY_FOR_DISPATCH: 'מוכן למשלוח',
  DISPATCH: 'שגר הזמנה',
  MARK_COMPLETED: 'סמן כהושלם',
  REPORT_DELIVERY_ISSUE: 'דווח על בעיית משלוח',
  RETURN_TO_DISPATCH: 'החזר למשלוח',
  RESUME: 'חדש טיפול',
  UPDATE_HOLD_REASON: 'עדכן סיבת המתנה',
  CANCEL: 'בטל הזמנה',
  CHANGE_PRIORITY: 'שנה עדיפות',
};

// ============================================================================
// STATUS → ALLOWED ACTIONS
// ============================================================================

export const STATUS_ACTIONS: Record<OrderStatus, OrderAction[]> = {
  NEW: ['ASSIGN_OWNER', 'START_REVIEW', 'PUT_ON_HOLD', 'CHANGE_PRIORITY', 'ADD_NOTE'],
  NEEDS_REVIEW: ['APPROVE', 'PUT_ON_HOLD', 'ADD_NOTE', 'CHANGE_PRIORITY'],
  APPROVED: ['START_PREPARATION', 'REASSIGN_OWNER', 'PUT_ON_HOLD', 'CHANGE_PRIORITY', 'ADD_NOTE'],
  IN_PREPARATION: ['MARK_ITEM_PICKED', 'REPORT_MISSING_ITEMS', 'MARK_PREPARATION_COMPLETED', 'ADD_NOTE', 'PUT_ON_HOLD'],
  MISSING_ITEMS: ['UPDATE_SHORTAGE', 'RETURN_TO_PREPARATION', 'PUT_ON_HOLD', 'ADD_NOTE'],
  READY_FOR_SCHEDULING: ['SCHEDULE_DELIVERY', 'SCHEDULE_INSTALLATION', 'PUT_ON_HOLD', 'ADD_NOTE'],
  SCHEDULED: ['EDIT_SCHEDULE', 'MARK_READY_FOR_DISPATCH', 'PUT_ON_HOLD', 'ADD_NOTE'],
  READY_FOR_DISPATCH: ['DISPATCH', 'PUT_ON_HOLD', 'ADD_NOTE'],
  OUT_FOR_DELIVERY: ['MARK_COMPLETED', 'REPORT_DELIVERY_ISSUE', 'RETURN_TO_DISPATCH', 'ADD_NOTE'],
  COMPLETED: ['ADD_NOTE'],
  ON_HOLD: ['RESUME', 'UPDATE_HOLD_REASON', 'CANCEL', 'ADD_NOTE'],
  CANCELLED: ['ADD_NOTE'],
};

// ============================================================================
// ACTION → TARGET STATUS
// ============================================================================

export const ACTION_TARGET_STATUS: Partial<Record<OrderAction, OrderStatus>> = {
  START_REVIEW: 'NEEDS_REVIEW',
  APPROVE: 'APPROVED',
  START_PREPARATION: 'IN_PREPARATION',
  REPORT_MISSING_ITEMS: 'MISSING_ITEMS',
  MARK_PREPARATION_COMPLETED: 'READY_FOR_SCHEDULING',
  RETURN_TO_PREPARATION: 'IN_PREPARATION',
  SCHEDULE_DELIVERY: 'SCHEDULED',
  SCHEDULE_INSTALLATION: 'SCHEDULED',
  MARK_READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  DISPATCH: 'OUT_FOR_DELIVERY',
  MARK_COMPLETED: 'COMPLETED',
  RETURN_TO_DISPATCH: 'READY_FOR_DISPATCH',
  PUT_ON_HOLD: 'ON_HOLD',
  CANCEL: 'CANCELLED',
};

// ============================================================================
// VALID TRANSITIONS (for drag-and-drop kanban)
// ============================================================================

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['NEEDS_REVIEW', 'ON_HOLD'],
  NEEDS_REVIEW: ['APPROVED', 'ON_HOLD'],
  APPROVED: ['IN_PREPARATION', 'ON_HOLD'],
  IN_PREPARATION: ['MISSING_ITEMS', 'READY_FOR_SCHEDULING', 'ON_HOLD'],
  MISSING_ITEMS: ['IN_PREPARATION', 'ON_HOLD'],
  READY_FOR_SCHEDULING: ['SCHEDULED', 'ON_HOLD'],
  SCHEDULED: ['READY_FOR_DISPATCH', 'ON_HOLD'],
  READY_FOR_DISPATCH: ['OUT_FOR_DELIVERY', 'ON_HOLD'],
  OUT_FOR_DELIVERY: ['COMPLETED', 'READY_FOR_DISPATCH'],
  COMPLETED: [],
  ON_HOLD: ['NEW', 'NEEDS_REVIEW', 'APPROVED', 'IN_PREPARATION', 'READY_FOR_SCHEDULING', 'SCHEDULED', 'READY_FOR_DISPATCH', 'CANCELLED'],
  CANCELLED: [],
};

// ============================================================================
// ROLE-BASED ACTION PERMISSIONS
// ============================================================================

const MANAGER_ONLY_ACTIONS: Set<OrderAction> = new Set([
  'CANCEL',
  'CHANGE_PRIORITY',
  'REASSIGN_OWNER',
]);

const WORKER_ALLOWED_ACTIONS: Set<OrderAction> = new Set([
  'START_REVIEW',
  'MARK_ITEM_PICKED',
  'REPORT_MISSING_ITEMS',
  'MARK_PREPARATION_COMPLETED',
  'ADD_NOTE',
  'UPDATE_SHORTAGE',
  'RETURN_TO_PREPARATION',
]);

const FULL_WORKFLOW_ROLES: Set<UserRole> = new Set([
  'ADMIN',
  'SALES',
  'PURCHASING',
]);

const LIMITED_WORKFLOW_ROLES: Set<UserRole> = new Set([
  'OPERATIONS',
  'INSTALLER',
]);

export function getActionsForRole(status: OrderStatus, role: UserRole): OrderAction[] {
  const allActions = STATUS_ACTIONS[status] || [];

  if (FULL_WORKFLOW_ROLES.has(role)) {
    return allActions;
  }

  if (!LIMITED_WORKFLOW_ROLES.has(role)) {
    return [];
  }

  return allActions.filter(
    (action) => !MANAGER_ONLY_ACTIONS.has(action) && (WORKER_ALLOWED_ACTIONS.has(action) || action === 'ADD_NOTE')
  );
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface OrderForValidation {
  customerId: string;
  status: OrderStatus;
  requiresDelivery: boolean;
  customer?: {
    fullName: string;
    phone: string | null;
    addresses?: { id: string }[];
  } | null;
  items?: {
    status: string;
    missingQuantity: number;
  }[];
  scheduledDate?: Date | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  addressId?: string | null;
}

export function validateTransition(
  order: OrderForValidation,
  targetStatus: OrderStatus
): ValidationResult {
  const errors: string[] = [];

  // Check if transition is valid
  const validTargets = VALID_TRANSITIONS[order.status];
  if (!validTargets?.includes(targetStatus)) {
    errors.push(`לא ניתן לעבור מ-${order.status} ל-${targetStatus}`);
    return { valid: false, errors };
  }

  // APPROVE validation (from NEEDS_REVIEW)
  if (targetStatus === 'APPROVED') {
    if (!order.customer?.fullName) errors.push('שם לקוח חסר');
    if (!order.customer?.phone) errors.push('טלפון לקוח חסר');
    if (!order.items || order.items.length === 0) errors.push('נדרש לפחות פריט אחד');
    if (order.requiresDelivery && !order.addressId) errors.push('כתובת נדרשת למשלוח');
  }

  // READY_FOR_SCHEDULING validation (from IN_PREPARATION)
  if (targetStatus === 'READY_FOR_SCHEDULING') {
    const hasUnreadyItems = order.items?.some(
      (item) => item.status !== 'READY' && item.status !== 'PICKED'
    );
    const hasMissing = order.items?.some((item) => item.missingQuantity > 0);
    if (hasUnreadyItems) errors.push('לא כל הפריטים מוכנים');
    if (hasMissing) errors.push('יש פריטים חסרים שטרם טופלו');
  }

  // SCHEDULED validation
  if (targetStatus === 'SCHEDULED') {
    if (!order.scheduledDate) errors.push('נדרש תאריך תזמון');
    if (!order.timeWindowStart || !order.timeWindowEnd) errors.push('נדרש חלון זמן');
  }

  // COMPLETED validation
  if (targetStatus === 'COMPLETED') {
    if (order.status !== 'OUT_FOR_DELIVERY') {
      errors.push('ניתן להשלים רק לאחר שההזמנה נשלחה');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isTransitionValid(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
