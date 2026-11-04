import type { TranslateOptions } from '@/lib/i18n/types';

const ORDER_FIELD_LABELS: Record<string, { he: string; en: string }> = {
  number: { he: 'מספר הזמנה', en: 'Order Number' },
  customerName: { he: 'שם לקוח', en: 'Customer Name' },
  customerPhone: { he: 'טלפון לקוח', en: 'Customer Phone' },
  status: { he: 'סטטוס', en: 'Status' },
  total: { he: 'סכום', en: 'Total' },
  createdAt: { he: 'תאריך יצירה', en: 'Created At' },
  updatedAt: { he: 'עודכן', en: 'Updated At' },
  paymentStatus: { he: 'סטטוס תשלום', en: 'Payment Status' },
  installationDate: { he: 'תאריך התקנה', en: 'Installation Date' },
};

export function translateOrderField(field: string, opts?: TranslateOptions): string {
  const locale = opts?.locale ?? 'he';
  const key = String(field);
  const entry = ORDER_FIELD_LABELS[key];
  if (!entry) return opts?.fallback ?? key;
  return entry[locale] ?? entry.he;
}
