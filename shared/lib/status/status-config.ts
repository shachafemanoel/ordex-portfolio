/**
 * Status Configuration System
 *
 * Single source of truth for all status-related UI concerns.
 * Derives from Prisma enums to ensure type safety and consistency.
 *
 * Maps each status to:
 * - Hebrew label
 * - Color (CSS variable reference)
 * - Icon name
 * - Allowed actions (contextual quick actions)
 * - Potential blockers
 */

import { OrderStatus, PaymentStatus } from '@prisma/client';

export interface StatusConfig {
  labelHe: string;
  color: string; // CSS variable reference
  icon: string; // Lucide icon name
  allowedActions: string[];
  blockers: string[];
}

/**
 * Order Status Configuration
 * Source of truth: Prisma OrderStatus enum
 */
export const orderStatusConfig: Record<OrderStatus, StatusConfig> = {
  RECEIVED: {
    labelHe: 'התקבל',
    color: 'var(--color-status-received)',
    icon: 'Inbox',
    allowedActions: ['edit', 'process', 'cancel'],
    blockers: ['MISSING_CUSTOMER', 'MISSING_ITEMS'],
  },

  PROCESSING: {
    labelHe: 'בטיפול',
    color: 'var(--color-status-processing)',
    icon: 'Loader',
    allowedActions: ['update_items', 'create_po', 'mark_ready', 'cancel'],
    blockers: ['MISSING_PRODUCTS', 'LOW_STOCK'],
  },

  READY: {
    labelHe: 'מוכן',
    color: 'var(--color-status-ready)',
    icon: 'CheckSquare',
    allowedActions: ['dispatch', 'schedule_installation', 'cancel'],
    blockers: ['INCOMPLETE_STOCK'],
  },

  IN_TRANSIT: {
    labelHe: 'בדרך',
    color: 'var(--color-status-in-transit)',
    icon: 'Truck',
    allowedActions: ['track_delivery', 'mark_delivered', 'cancel'],
    blockers: ['DELIVERY_DELAYED'],
  },

  INSTALLATION: {
    labelHe: 'בהתקנה',
    color: 'var(--color-status-installation)',
    icon: 'Wrench',
    allowedActions: ['mark_completed', 'report_issue', 'reschedule'],
    blockers: ['TECHNICIAN_UNAVAILABLE', 'MISSING_EQUIPMENT'],
  },

  DRAFT: {
    labelHe: 'טיוטה',
    color: 'var(--color-status-draft)',
    icon: 'FileEdit',
    allowedActions: ['edit', 'delete', 'submit_for_approval'],
    blockers: ['MISSING_CUSTOMER', 'MISSING_ITEMS'],
  },

  PENDING_APPROVAL: {
    labelHe: 'ממתין לאישור',
    color: 'var(--color-status-pending-approval)',
    icon: 'Clock',
    allowedActions: ['approve', 'reject', 'edit', 'request_changes'],
    blockers: ['MISSING_APPROVAL', 'MISSING_MANAGER_REVIEW'],
  },

  CONFIRMED: {
    labelHe: 'מאושר',
    color: 'var(--color-status-confirmed)',
    icon: 'CheckCircle',
    allowedActions: ['create_po', 'schedule_installation', 'cancel'],
    blockers: ['MISSING_PRODUCTS', 'LOW_STOCK', 'MISSING_SUPPLIER'],
  },

  TO_DO: {
    labelHe: 'לביצוע',
    color: 'var(--color-status-to-do)',
    icon: 'ListTodo',
    allowedActions: ['start', 'assign', 'prioritize'],
    blockers: ['MISSING_ASSIGNMENT', 'MISSING_DUE_DATE'],
  },

  CALL_BACK: {
    labelHe: 'חזרה ללקוח',
    color: 'var(--color-status-call-back)',
    icon: 'Phone',
    allowedActions: ['call', 'send_message', 'reschedule_callback'],
    blockers: ['MISSING_CONTACT', 'UNREACHABLE_CUSTOMER'],
  },

  PO_CREATED: {
    labelHe: 'נוצרה הזמנת רכש',
    color: 'var(--color-status-po-created)',
    icon: 'ShoppingCart',
    allowedActions: ['view_po', 'send_to_supplier', 'cancel'],
    blockers: ['PO_NOT_SENT', 'SUPPLIER_NOT_CONFIRMED'],
  },

  AWAITING_STOCK: {
    labelHe: 'ממתין למלאי',
    color: 'var(--color-status-awaiting-stock)',
    icon: 'Package',
    allowedActions: ['check_stock_status', 'contact_supplier', 'cancel'],
    blockers: ['OUT_OF_STOCK', 'SUPPLIER_DELAYED'],
  },

  PARTIALLY_SUPPLIED: {
    labelHe: 'סופק חלקית',
    color: 'var(--color-status-partially-supplied)',
    icon: 'PackageCheck',
    allowedActions: ['receive_remaining', 'schedule_partial_install', 'adjust_order'],
    blockers: ['INCOMPLETE_STOCK', 'MISSING_ITEMS'],
  },

  INSTALL_SCHEDULING: {
    labelHe: 'תזמון התקנה',
    color: 'var(--color-status-install-scheduling)',
    icon: 'Calendar',
    allowedActions: ['schedule', 'assign_technician', 'contact_customer'],
    blockers: ['UNSCHEDULED', 'NO_AVAILABLE_TECHNICIAN', 'CUSTOMER_UNAVAILABLE'],
  },

  SCHEDULED: {
    labelHe: 'מתוזמן',
    color: 'var(--color-status-scheduled)',
    icon: 'CalendarCheck',
    allowedActions: ['reschedule', 'start_installation', 'cancel'],
    blockers: ['MISSING_TECHNICIAN', 'MISSING_EQUIPMENT', 'WEATHER_DELAY'],
  },

  READY_FOR_INSTALL: {
    labelHe: 'מוכן להתקנה',
    color: 'var(--color-status-ready-for-install)',
    icon: 'Hammer',
    allowedActions: ['start_installation', 'reschedule', 'check_preparation'],
    blockers: [],
  },

  AWAITING_INSTALL: {
    labelHe: 'ממתין להתקנה',
    color: 'var(--color-status-awaiting-install)',
    icon: 'Clock',
    allowedActions: ['start_installation', 'check_delay', 'reschedule'],
    blockers: ['INSTALL_DELAYED', 'TECHNICIAN_LATE'],
  },

  SUPPLIED: {
    labelHe: 'סופק',
    color: 'var(--color-status-supplied)',
    icon: 'CheckCircle',
    allowedActions: ['create_invoice', 'complete', 'report_issue'],
    blockers: [],
  },

  INVOICED: {
    labelHe: 'חויב',
    color: 'var(--color-status-invoiced)',
    icon: 'FileText',
    allowedActions: ['view_invoice', 'send_invoice', 'record_payment', 'complete'],
    blockers: ['UNPAID', 'PAYMENT_PENDING'],
  },

  COMPLETED: {
    labelHe: 'הושלם',
    color: 'var(--color-status-completed)',
    icon: 'CheckCircle2',
    allowedActions: ['view', 'archive', 'duplicate', 'request_feedback'],
    blockers: [],
  },

  CANCELLED: {
    labelHe: 'בוטל',
    color: 'var(--color-status-cancelled)',
    icon: 'XCircle',
    allowedActions: ['view', 'archive', 'restore'],
    blockers: [],
  },
  INSTALLED: {
    labelHe: 'מותקן',
    color: 'var(--color-status-completed)',
    icon: 'Hammer',
    allowedActions: ['view', 'archive'],
    blockers: [],
  },
  CLOSED: {
    labelHe: 'סגור',
    color: 'var(--color-status-draft)',
    icon: 'Lock',
    allowedActions: ['view'],
    blockers: [],
  },
  ON_HOLD: {
    labelHe: 'בהמתנה',
    color: 'var(--color-status-call-back)',
    icon: 'PauseCircle',
    allowedActions: ['resume', 'cancel'],
    blockers: [],
  },
  REFUNDED: {
    labelHe: 'זוכה',
    color: 'var(--color-status-cancelled)',
    icon: 'RotateCcw',
    allowedActions: ['view'],
    blockers: [],
  },
};

/**
 * Payment Status Configuration
 */
export const paymentStatusConfig: Record<PaymentStatus, StatusConfig> = {
  PENDING: {
    labelHe: 'ממתין לתשלום',
    color: 'var(--color-warning-500)',
    icon: 'Clock',
    allowedActions: ['record_payment', 'send_reminder'],
    blockers: ['PAYMENT_OVERDUE'],
  },

  AUTHORIZED: {
    labelHe: 'מאושר',
    color: 'var(--color-primary-500)',
    icon: 'ShieldCheck',
    allowedActions: ['capture_payment', 'void_authorization'],
    blockers: [],
  },

  PAID: {
    labelHe: 'שולם',
    color: 'var(--color-success-500)',
    icon: 'CheckCircle',
    allowedActions: ['view_receipt', 'refund'],
    blockers: [],
  },

  FAILED: {
    labelHe: 'נכשל',
    color: 'var(--color-danger-500)',
    icon: 'XCircle',
    allowedActions: ['retry_payment', 'contact_customer'],
    blockers: ['PAYMENT_FAILED'],
  },

  REFUNDED: {
    labelHe: 'הוחזר',
    color: 'var(--color-neutral-500)',
    icon: 'RotateCcw',
    allowedActions: ['view_refund'],
    blockers: [],
  },

  PARTIAL: {
    labelHe: 'חלקי',
    color: 'var(--color-warning-500)',
    icon: 'AlertCircle',
    allowedActions: ['record_payment', 'adjust_balance'],
    blockers: ['BALANCE_REMAINING'],
  },
};

/**
 * Helper: Get status config for an order
 */
export function getOrderStatusConfig(status: OrderStatus): StatusConfig {
  return orderStatusConfig[status];
}

/**
 * Helper: Get status config for payment
 */
export function getPaymentStatusConfig(status: PaymentStatus): StatusConfig {
  return paymentStatusConfig[status];
}

/**
 * Helper: Get all order statuses
 */
export function getAllOrderStatuses(): OrderStatus[] {
  return Object.keys(orderStatusConfig) as OrderStatus[];
}

/**
 * Helper: Get all payment statuses
 */
export function getAllPaymentStatuses(): PaymentStatus[] {
  return Object.keys(paymentStatusConfig) as PaymentStatus[];
}

/**
 * Helper: Check if action is allowed for status
 */
export function isActionAllowed(status: OrderStatus | PaymentStatus, action: string): boolean {
  const config =
    status in orderStatusConfig
      ? orderStatusConfig[status as OrderStatus]
      : paymentStatusConfig[status as PaymentStatus];

  return config.allowedActions.includes(action);
}

/**
 * Helper: Get blockers for status
 */
export function getStatusBlockers(status: OrderStatus | PaymentStatus): string[] {
  const config =
    status in orderStatusConfig
      ? orderStatusConfig[status as OrderStatus]
      : paymentStatusConfig[status as PaymentStatus];

  return config.blockers;
}
