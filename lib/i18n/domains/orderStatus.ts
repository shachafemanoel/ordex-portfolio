import type { TranslateOptions } from '@/lib/i18n/types';
import type { CanonicalOrderStatus } from '@/lib/orderStatus';

const labels: Record<CanonicalOrderStatus, { he: string; en: string }> = {
  // --- Core statuses ---
  RECEIVED: { he: 'התקבל', en: 'Received' },
  PROCESSING: { he: 'בטיפול', en: 'Processing' },
  READY: { he: 'מוכן', en: 'Ready' },
  IN_TRANSIT: { he: 'בדרך', en: 'In Transit' },
  INSTALLATION: { he: 'בהתקנה', en: 'Installation' },
  COMPLETED: { he: 'הושלם', en: 'Completed' },
  // --- Legacy statuses ---
  DRAFT: { he: 'טיוטה', en: 'Draft' },
  TO_DO: { he: 'לביצוע', en: 'To Do' },
  CALL_BACK: { he: 'חזרה ללקוח', en: 'Call Back' },
  PENDING_APPROVAL: { he: 'ממתין לאישור', en: 'Pending Approval' },
  CONFIRMED: { he: 'אושר', en: 'Confirmed' },
  PO_CREATED: { he: 'הזמנת רכש נוצרה', en: 'PO Created' },
  AWAITING_STOCK: { he: 'ממתין למלאי', en: 'Awaiting Stock' },
  PARTIALLY_SUPPLIED: { he: 'סופק חלקית', en: 'Partially Supplied' },
  READY_FOR_INSTALL: { he: 'מוכן להתקנה', en: 'Ready for Install' },
  INSTALL_SCHEDULING: { he: 'תיאום התקנה', en: 'Install Scheduling' },
  AWAITING_INSTALL: { he: 'ממתין להתקנה', en: 'Awaiting Install' },
  SCHEDULED: { he: 'מתוזמן', en: 'Scheduled' },
  INSTALLED: { he: 'הותקן', en: 'Installed' },
  SUPPLIED: { he: 'סופק', en: 'Supplied' },
  INVOICED: { he: 'חשבונית', en: 'Invoiced' },
  CLOSED: { he: 'נסגר', en: 'Closed' },
  ON_HOLD: { he: 'מושהה', en: 'On Hold' },
  CANCELLED: { he: 'בוטל', en: 'Cancelled' },
  REFUNDED: { he: 'הוחזר', en: 'Refunded' },
};

export function translateOrderStatus(
  status: CanonicalOrderStatus | string,
  opts?: TranslateOptions
): string {
  const locale = opts?.locale ?? 'he';
  const key = String(status).toUpperCase() as CanonicalOrderStatus;
  const entry = labels[key];
  if (!entry) return opts?.fallback ?? String(status);
  return entry[locale] ?? entry.he;
}
