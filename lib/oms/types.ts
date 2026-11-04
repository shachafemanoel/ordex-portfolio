/**
 * OMS Core Types and Constants
 * Hebrew labels for UI, English enums for code
 */

import type { UserRole } from '@prisma/client';
export type { UserRole };
// Legacy UI workflow vocabulary; these are not persisted Prisma enum values.
export type OrderStatus = 'NEW' | 'NEEDS_REVIEW' | 'APPROVED' | 'IN_PREPARATION' | 'MISSING_ITEMS' | 'READY_FOR_SCHEDULING' | 'SCHEDULED' | 'READY_FOR_DISPATCH' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
export type OrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type OrderItemStatus = 'PENDING' | 'PICKED' | 'MISSING' | 'READY';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

// ============================================================================
// STATUS LABELS (Hebrew)
// ============================================================================

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'חדשה',
  NEEDS_REVIEW: 'ממתינה לבדיקה',
  APPROVED: 'מאושרת',
  IN_PREPARATION: 'בהכנה',
  MISSING_ITEMS: 'פריטים חסרים',
  READY_FOR_SCHEDULING: 'מוכנה לתזמון',
  SCHEDULED: 'מתוזמנת',
  READY_FOR_DISPATCH: 'מוכנה למשלוח',
  OUT_FOR_DELIVERY: 'במשלוח',
  COMPLETED: 'הושלמה',
  ON_HOLD: 'בהמתנה',
  CANCELLED: 'בוטלה',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; border: string; dot: string }> = {
  NEW: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  NEEDS_REVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  APPROVED: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  IN_PREPARATION: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  MISSING_ITEMS: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  READY_FOR_SCHEDULING: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  SCHEDULED: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
  READY_FOR_DISPATCH: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  OUT_FOR_DELIVERY: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  ON_HOLD: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', dot: 'bg-slate-400' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300', dot: 'bg-gray-400' },
};

export const PRIORITY_LABELS: Record<OrderPriority, string> = {
  LOW: 'נמוכה',
  NORMAL: 'רגילה',
  HIGH: 'גבוהה',
  URGENT: 'דחוף',
};

export const PRIORITY_COLORS: Record<OrderPriority, { bg: string; text: string }> = {
  LOW: { bg: 'bg-slate-100', text: 'text-slate-600' },
  NORMAL: { bg: 'bg-blue-50', text: 'text-blue-700' },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-700' },
  URGENT: { bg: 'bg-red-50', text: 'text-red-700' },
};

export const ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  PENDING: 'ממתין',
  PICKED: 'נאסף',
  MISSING: 'חסר',
  READY: 'מוכן',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: 'פתוח',
  IN_PROGRESS: 'בתהליך',
  DONE: 'הושלם',
  CANCELLED: 'בוטל',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'מנהל',
  SALES: 'מכירות',
  PURCHASING: 'רכש',
  INSTALLER: 'מתקין',
  OPERATIONS: 'עובד אופרציה',
  VIEWER: 'צפייה',
};

// ============================================================================
// KANBAN COLUMN ORDER
// ============================================================================

export const KANBAN_COLUMNS: OrderStatus[] = [
  'NEW',
  'NEEDS_REVIEW',
  'APPROVED',
  'IN_PREPARATION',
  'MISSING_ITEMS',
  'READY_FOR_SCHEDULING',
  'SCHEDULED',
  'READY_FOR_DISPATCH',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
];

// Statuses to show in dashboard KPI cards
export const DASHBOARD_KPI_STATUSES: OrderStatus[] = [
  'NEW',
  'NEEDS_REVIEW',
  'IN_PREPARATION',
  'READY_FOR_SCHEDULING',
  'OUT_FOR_DELIVERY',
  'ON_HOLD',
];
