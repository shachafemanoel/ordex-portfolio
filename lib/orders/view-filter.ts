import { OrderStatus } from '@prisma/client';

/**
 * The 4 Wolt-style operational views for orders.
 */
export type OpsView = 'today' | 'inProgress' | 'scheduled' | 'done';

/**
 * Status-to-view mapping based on the spec:
 * - Today: לחזור ללקוח, טיפול/לביצוע, תאום התקנה (actionable)
 * - In Progress: הזמנת רכש, ממתין לקבלת סחורה, סופק חלקי
 * - Scheduled: ממתין להתקנה/הספקה (with date set)
 * - Done: סופק, בוטלה
 */
const VIEW_STATUS_MAP: Record<OpsView, OrderStatus[]> = {
  today: [
    'TO_DO',
    'RECEIVED',
    'DRAFT',
    'PENDING_APPROVAL',
    'CONFIRMED',
    'CALL_BACK',
    'INSTALL_SCHEDULING',
    'READY_FOR_INSTALL',
    'READY',
    'ON_HOLD',
  ],
  inProgress: [
    'PO_CREATED',
    'PROCESSING',
    'AWAITING_STOCK',
    'PARTIALLY_SUPPLIED',
  ],
  scheduled: [
    'SCHEDULED',
    'AWAITING_INSTALL',
    'IN_TRANSIT',
    'INSTALLATION',
  ],
  done: [
    'SUPPLIED',
    'INSTALLED',
    'INVOICED',
    'COMPLETED',
    'CLOSED',
    'CANCELLED',
    'REFUNDED',
  ],
};

/**
 * Get the statuses corresponding to a view.
 */
export function getStatusesForView(view: OpsView): OrderStatus[] {
  return VIEW_STATUS_MAP[view] ?? [];
}

/**
 * Get which view an order belongs to based on status.
 */
export function getViewForStatus(status: OrderStatus): OpsView {
  for (const [view, statuses] of Object.entries(VIEW_STATUS_MAP) as [OpsView, OrderStatus[]][]) {
    if (statuses.includes(status)) return view;
  }
  return 'today'; // Default fallback
}

/**
 * View metadata for UI tabs.
 */
export const VIEW_META: Record<OpsView, { labelHe: string; labelEn: string; icon: string }> = {
  today: { labelHe: 'היום', labelEn: 'Today', icon: 'Zap' },
  inProgress: { labelHe: 'בתהליך', labelEn: 'In Progress', icon: 'Loader' },
  scheduled: { labelHe: 'מתוזמן', labelEn: 'Scheduled', icon: 'Calendar' },
  done: { labelHe: 'הושלם', labelEn: 'Done', icon: 'CheckCircle' },
};
