import { ORDER_STATUS_UI_MAP } from '@/src/server/services/ops-triggers.service';

/**
 * Operational Hebrew labels for technical status codes.
 * This is the single source of truth for presentation-layer status labels.
 */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  ...ORDER_STATUS_UI_MAP,
  // Detailed Workflow Labels (from taskLabelMap and others)
  VERIFY_PAYMENT: 'בדיקת תשלום',
  CALLBACK_CUSTOMER: 'לחזור ללקוח',
  VERIFY_STOCK: 'בדיקת מלאי',
  CREATE_PURCHASE_ORDER: 'הוצאת הזמנת רכש',
  WAIT_SUPPLIER_DELIVERY: 'ממתין לספק',
  RECEIVE_GOODS_PARTIAL: 'קליטת סחורה חלקית',
  SCHEDULE_INSTALLATION: 'תאום התקנה',
  WAIT_INSTALLATION_DAY: 'ממתין להתקנה/הספקה',
  CLOSE_ORDER: 'סיום הזמנה',
  VERIFY_ORDER: 'בדיקת הזמנה',
  ASSIGN_SUPPLIERS: 'שיוך ספקים',
  RECEIVE_GOODS: 'קליטת סחורה',
};

export const ORDER_STATUS_ICONS: Record<string, string> = {
  DRAFT: '📝',
  NEW: '✨',
  PENDING: '⏳',
  PROCESSING: '⚙️',
  COMPLETED: '✅',
  CANCELLED: '❌',
  CALL_BACK: '📞',
  ON_HOLD: '⏸️',
  AWAITING_STOCK: '📦',
  PO_CREATED: '📝',
  READY: '🏁',
  SCHEDULED: '📅',
  IN_TRANSIT: '🚚',
  INSTALLATION: '🛠️',
  INSTALLED: '🛠️',
  SUPPLIED: '📦',
  INVOICED: '🧾',
  CLOSED: '🔒',
  REFUNDED: '💰',
  VERIFY_PAYMENT: '💳',
};

/**
 * Returns a human-friendly Hebrew label for any technical status code.
 * Falls back to "סטטוס לא מזוהה" if the status is unknown.
 */
export function getOrderStatusLabel(status: string | undefined | null): string {
  if (!status) return 'בלי סטטוס';
  const upperStatus = status.toUpperCase();
  return (
    ORDER_STATUS_LABELS[upperStatus] || ORDER_STATUS_LABELS[status] || status || 'סטטוס לא מזוהה'
  );
}

/**
 * Returns an emoji icon for the status.
 */
export function getOrderStatusIcon(status: string | undefined | null): string {
  if (!status) return '❓';
  const upperStatus = status.toUpperCase();
  return ORDER_STATUS_ICONS[upperStatus] || ORDER_STATUS_ICONS[status] || '';
}
