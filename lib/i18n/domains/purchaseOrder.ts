import type { TranslateOptions } from '@/lib/i18n/types';

const PURCHASE_ORDER_STATUS_LABELS: Record<string, { he: string; en: string }> = {
  DRAFT: { he: 'טיוטה', en: 'Draft' },
  SENT: { he: 'נשלח', en: 'Sent' },
  PARTIALLY_RECEIVED: { he: 'התקבל חלקית', en: 'Partially Received' },
  RECEIVED: { he: 'התקבל', en: 'Received' },
  CANCELLED: { he: 'בוטל', en: 'Cancelled' },
  CONFIRMED: { he: 'מאושר', en: 'Confirmed' },
  OPEN: { he: 'פתוח', en: 'Open' },
  COMPLETE: { he: 'הושלם', en: 'Complete' },
  PARTIAL: { he: 'חלקי', en: 'Partial' },
};

export function translatePurchaseOrderStatus(status?: string | null, opts?: TranslateOptions): string {
  if (!status) return opts?.fallback ?? 'סטטוס לא זמין';
  const locale = opts?.locale ?? 'he';
  const key = String(status).toUpperCase();
  const entry = PURCHASE_ORDER_STATUS_LABELS[key];
  if (!entry) return opts?.fallback ?? String(status);
  return entry[locale] ?? entry.he;
}
