/**
 * Workflow Requirements - Order Status Transition Rules
 *
 * This file defines the REQUIRED ACTIONS and CONDITIONS for each status transition
 * based on the specification document (docs/assets/order-management-spec.docx).
 *
 * Each status transition requires specific fields and actions to be completed.
 */

import type { OrderStatus } from '@prisma/client';
import { ORDER_STATUS_TRANSITIONS } from '@/lib/orderStatus';

/**
 * Required fields for each status transition
 */
// Enum for machine-readable action types
export enum WorkflowActionType {
  SEND_EMAIL = 'SEND_EMAIL',
  SEND_SMS = 'SEND_SMS',
  CREATE_TASK = 'CREATE_TASK',
  CREATE_PURCHASE_ORDER = 'CREATE_PURCHASE_ORDER',
  SYNC_INVENTORY = 'SYNC_INVENTORY',
  SYNC_CALENDAR = 'SYNC_CALENDAR',
  UPDATE_FIELD = 'UPDATE_FIELD',
  QUEUE_JOB = 'QUEUE_JOB',
}

export interface WorkflowAction {
  type: WorkflowActionType;
  label: string; // Human readable description
  payload?: any; // Action specific configuration
}

export interface Action {
  type: string;
  id: string;
  label: string;
  payload?: Record<string, unknown>;
  isPrimary?: boolean;
}

/**
 * Required fields for each status transition
 */
export interface StatusRequirements {
  /** Status being transitioned TO */
  targetStatus: OrderStatus;

  /** Required order fields that must be filled */
  requiredFields: string[];

  /** Required conditions that must be met */
  conditions: {
    name: string;
    check: (order: any) => boolean;
    message: string;
  }[];

  /** Actions that will be automatically triggered */
  automaticActions: WorkflowAction[];

  /** Manual actions user must perform */
  manualActions: string[];

  /** Description of this workflow stage */
  description: string;
}

/** An item is ready when it was allocated from stock or received from a supplier. */
export function isItemReady(item: { received?: boolean | null; allocationStatus?: string | null }): boolean {
  return Boolean(item.received) || item.allocationStatus === 'ALLOCATED';
}

function hasCustomerContact(order: any): boolean {
  const name = order.customerName ?? order.customer?.name;
  const phone = order.customerPhone ?? order.customer?.phone;
  return Boolean(name?.trim?.()) && Boolean(phone?.trim?.());
}

function hasCompleteShippingAddress(order: any): boolean {
  const address = order.shippingAddress;
  return Boolean(address?.city?.trim?.() && address?.street?.trim?.() && address?.number?.trim?.());
}

const hasScheduleCondition = {
  name: 'has_schedule',
  check: (order: any) => Boolean(order.scheduledAt),
  message: 'יש לקבוע תאריך לפני יציאה למשלוח או להתקנה',
};

/** Authorizations and payment-method selection are not receipts. */
export function hasFullPayment(order: { totalCents?: number; paidAmountCents?: number; paymentStatus?: string }): boolean {
  const { totalCents, paidAmountCents, paymentStatus } = order;
  return Number.isSafeInteger(totalCents) && Number.isSafeInteger(paidAmountCents) &&
    totalCents! >= 0 && paidAmountCents! >= totalCents! && (totalCents === 0 || paymentStatus === 'PAID');
}

const fullPaymentCondition = {
  name: 'full_payment', check: hasFullPayment,
  message: 'נדרש תשלום מלא לפני יציאה למשלוח או להתקנה',
};
const storeReviewCondition = {
  name: 'store_review', check: (order: any) => !order.sourceReviewReason,
  message: 'עדכון מהחנות דורש בדיקה לפני יציאה',
};

const reasonRequiredCondition = {
  name: 'reason_required',
  check: (order: any) => typeof order.reason === 'string' && order.reason.trim().length > 0,
  message: 'יש לציין סיבה',
};

const LEGACY_STATUS_DEFAULTS: StatusRequirements = {
  targetStatus: 'RECEIVED' as OrderStatus,
  description: 'סטטוס ישן',
  requiredFields: [],
  conditions: [],
  automaticActions: [],
  manualActions: [],
};

/**
 * Complete workflow requirements map
 * Maps target status → requirements needed to transition TO that status
 */
export const WORKFLOW_REQUIREMENTS: Record<OrderStatus, StatusRequirements> = {
  RECEIVED: {
    targetStatus: 'RECEIVED',
    description: 'הזמנה חדשה התקבלה',
    requiredFields: ['customerName', 'customerPhone'],
    conditions: [],
    automaticActions: [
      { type: WorkflowActionType.SEND_EMAIL, label: 'שליחת אימייל אישור הזמנה ללקוח' },
    ],
    manualActions: ['בדוק זמינות מלאי', 'אמת פרטי לקוח'],
  },
  PROCESSING: {
    targetStatus: 'PROCESSING',
    description: 'בטיפול (רכש/ליקוט)',
    requiredFields: ['items'],
    conditions: [
      {
        name: 'has_items',
        check: (order) => Array.isArray(order.items) && order.items.length > 0,
        message: 'חובה להוסיף פריטים להזמנה',
      },
      {
        name: 'customer_contact',
        check: hasCustomerContact,
        message: 'חסרים שם וטלפון של הלקוח',
      },
    ],
    automaticActions: [],
    manualActions: ['הזמן רכש מספק', 'לקט פריטים מהמלאי'],
  },
  READY: {
    targetStatus: 'READY',
    description: 'מוכן ליציאה',
    requiredFields: ['items'],
    conditions: [
      {
        name: 'items_ready',
        check: (order) =>
          Array.isArray(order.items) && order.items.length > 0 && order.items.every(isItemReady),
        message: 'כל הפריטים חייבים להיות מוכנים (שוריינו מהמלאי או התקבלו מספק)',
      },
      {
        name: 'shipping_address_complete',
        check: hasCompleteShippingAddress,
        message: 'חסרה כתובת מלאה (עיר, רחוב ומספר)',
      },
    ],
    automaticActions: [
      { type: WorkflowActionType.SEND_SMS, label: 'עדכון לקוח שההזמנה מוכנה' },
    ],
    manualActions: ['ארוז הזמנה', 'תאם מועד אספקה/התקנה'],
  },
  IN_TRANSIT: {
    targetStatus: 'IN_TRANSIT',
    description: 'יצא למשלוח',
    requiredFields: [],
    conditions: [hasScheduleCondition, fullPaymentCondition, storeReviewCondition],
    automaticActions: [],
    manualActions: ['הפק תעודת משלוח', 'מסור לשליח/מתקין'],
  },
  INSTALLATION: {
    targetStatus: 'INSTALLATION',
    description: 'בהתקנה אצל הלקוח',
    requiredFields: [],
    conditions: [hasScheduleCondition, fullPaymentCondition, storeReviewCondition],
    automaticActions: [],
    manualActions: ['בצע התקנה', 'חתים לקוח'],
  },
  COMPLETED: {
    targetStatus: 'COMPLETED',
    description: 'הושלם',
    requiredFields: [],
    conditions: [],
    automaticActions: [
      {
        type: WorkflowActionType.UPDATE_FIELD,
        label: 'עדכון תאריך סיום',
        payload: { field: 'completedAt', value: 'NOW' },
      },
    ],
    manualActions: ['סגור חשבון', 'הפק חשבונית מס'],
  },
  // Terminal / special statuses
  ON_HOLD: {
    ...LEGACY_STATUS_DEFAULTS,
    targetStatus: 'ON_HOLD',
    description: 'הזמנה מושהית',
    conditions: [reasonRequiredCondition],
  },
  CANCELLED: {
    ...LEGACY_STATUS_DEFAULTS,
    targetStatus: 'CANCELLED',
    description: 'הזמנה בוטלה',
    conditions: [reasonRequiredCondition],
  },
  REFUNDED: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'REFUNDED', description: 'הזמנה הוחזרה' },
  // Legacy statuses
  DRAFT: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'DRAFT', description: 'טיוטה' },
  TO_DO: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'TO_DO', description: 'לטיפול' },
  CALL_BACK: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'CALL_BACK', description: 'חזרה ללקוח' },
  PENDING_APPROVAL: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'PENDING_APPROVAL', description: 'ממתין לאישור' },
  CONFIRMED: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'CONFIRMED', description: 'אושר' },
  PO_CREATED: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'PO_CREATED', description: 'הזמנת רכש נוצרה' },
  AWAITING_STOCK: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'AWAITING_STOCK', description: 'ממתין למלאי' },
  PARTIALLY_SUPPLIED: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'PARTIALLY_SUPPLIED', description: 'סופק חלקית' },
  READY_FOR_INSTALL: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'READY_FOR_INSTALL', description: 'מוכן להתקנה' },
  INSTALL_SCHEDULING: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'INSTALL_SCHEDULING', description: 'תיאום התקנה' },
  AWAITING_INSTALL: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'AWAITING_INSTALL', description: 'ממתין להתקנה' },
  SCHEDULED: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'SCHEDULED', description: 'מתוזמן' },
  INSTALLED: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'INSTALLED', description: 'הותקן' },
  SUPPLIED: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'SUPPLIED', description: 'סופק' },
  INVOICED: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'INVOICED', description: 'חשבונית הופקה' },
  CLOSED: { ...LEGACY_STATUS_DEFAULTS, targetStatus: 'CLOSED', description: 'נסגר' },
};

/**
 * Get requirements for transitioning TO a specific status
 */
export function getStatusRequirements(targetStatus: OrderStatus): StatusRequirements {
  return WORKFLOW_REQUIREMENTS[targetStatus] || {
    targetStatus,
    description: targetStatus,
    requiredFields: [],
    conditions: [],
    automaticActions: [],
    manualActions: [],
  };
}

/**
 * Get progress percentage for a status
 */
export function getStatusProgressPercentage(status: OrderStatus): number {
  const progressMap: Partial<Record<OrderStatus, number>> = {
    RECEIVED: 10,
    PROCESSING: 30,
    READY: 60,
    IN_TRANSIT: 70,
    INSTALLATION: 80,
    COMPLETED: 100,
    CANCELLED: 100,
  };
  return progressMap[status] || 0;
}

/**
 * Validate conditions for transitioning to a target status
 */
export function validateStatusTransitionConditions(
  order: any,
  targetStatus: OrderStatus
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const req = getStatusRequirements(targetStatus);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  for (const field of req.requiredFields) {
    const value = field.includes('.')
      ? field.split('.').reduce((o: any, k: string) => o?.[k], order)
      : order[field];
    if (!value) {
      errors.push(`שדה חובה חסר: ${field}`);
    }
  }

  // Check conditions
  for (const cond of req.conditions) {
    if (!cond.check(order)) {
      errors.push(cond.message);
    }
  }

  // Check valid transitions
  const allowedTargets = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus] || [];
  if (!allowedTargets.includes(targetStatus)) {
    errors.push(`מעבר מ-${order.status} ל-${targetStatus} אינו מותר`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Get automatic actions for transitioning to a target status
 */
export function getAutomaticActions(targetStatus: OrderStatus): WorkflowAction[] {
  return getStatusRequirements(targetStatus).automaticActions;
}

/**
 * Get manual actions checklist for transitioning to a target status
 */
export function getManualActionsChecklist(targetStatus: OrderStatus): string[] {
  return getStatusRequirements(targetStatus).manualActions;
}

/**
 * Get workflow stage description
 */
export function getWorkflowStageDescription(status: OrderStatus): string {
  return getStatusRequirements(status).description;
}

/**
 * Get next actions for an order based on its current state
 */
export function getNextActions(order: any): Action[] {
  const actions: Action[] = [];
  const status = order.status as OrderStatus;

  // 1. Payment Action
  const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'AUTHORIZED';
  const isCancelled = status === 'CANCELLED';
  if (!isPaid && !isCancelled) {
    actions.push({
      type: 'OPEN_MODAL',
      id: 'quick_payment',
      label: 'עדכן תשלום',
      payload: { modal: 'PAYMENT' },
      isPrimary: status === 'RECEIVED',
    });
  }

  // 2. Address Action
  const hasShippingAddress =
    order.shippingAddress && order.shippingAddress.city && order.shippingAddress.street;
  if (!hasShippingAddress && !isCancelled) {
    actions.push({
      type: 'OPEN_MODAL',
      id: 'update_address',
      label: 'עדכן כתובת',
      payload: { modal: 'ADDRESS' },
      isPrimary: status === 'RECEIVED',
    });
  }

  // 3. Items Availability Action (for PROCESSING)
  const allItemsReceived = order.items?.every(isItemReady);
  if (
    !allItemsReceived &&
    !isCancelled &&
    status === 'PROCESSING'
  ) {
    actions.push({
      type: 'OPEN_MODAL',
      id: 'items_readiness',
      label: 'סמן פריטים כהתקבלו',
      payload: { modal: 'ITEMS_AVAILABILITY' },
      isPrimary: true,
    });
  }

  // 4. Scheduling Action (for READY)
  if (allItemsReceived && !order.scheduledAt && !isCancelled && status !== 'COMPLETED') {
    actions.push({
      type: 'OPEN_MODAL',
      id: 'schedule_install',
      label: 'תאם התקנה',
      payload: { modal: 'SCHEDULE' },
      isPrimary: status === 'READY',
    });
  }

  return actions.sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
}
