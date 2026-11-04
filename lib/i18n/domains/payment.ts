import type { TranslateOptions } from '@/lib/i18n/types';

const PAYMENT_STATUS_LABELS: Record<string, { he: string; en: string }> = {
  PENDING: { he: 'ממתין לתשלום', en: 'Pending' },
  AUTHORIZED: { he: 'מאושר', en: 'Authorized' },
  PAID: { he: 'שולם', en: 'Paid' },
  PARTIAL: { he: 'שולם חלקית', en: 'Partial' },
  FAILED: { he: 'נכשל', en: 'Failed' },
  REFUNDED: { he: 'הוחזר', en: 'Refunded' },
  OVERPAID: { he: 'שולם יתר', en: 'Overpaid' },
};

const PAYMENT_METHOD_LABELS: Record<string, { he: string; en: string }> = {
  CASH: { he: 'מזומן', en: 'Cash' },
  CARD: { he: 'אשראי', en: 'Card' },
  TRANSFER: { he: 'העברה בנקאית', en: 'Bank Transfer' },
  CHECK: { he: 'צ׳ק', en: 'Check' },
  PAYPAL: { he: 'PayPal', en: 'PayPal' },
  STRIPE: { he: 'Stripe', en: 'Stripe' },
};

export function translatePaymentStatus(status?: string | null, opts?: TranslateOptions): string {
  if (!status) return opts?.fallback ?? 'סטטוס לא זמין';
  const locale = opts?.locale ?? 'he';
  const key = String(status).toUpperCase();
  const entry = PAYMENT_STATUS_LABELS[key];
  if (!entry) return opts?.fallback ?? String(status);
  return entry[locale] ?? entry.he;
}

export function translatePaymentMethod(method?: string | null, opts?: TranslateOptions): string {
  if (!method) return opts?.fallback ?? 'אמצעי לא ידוע';
  const locale = opts?.locale ?? 'he';
  const key = String(method).toUpperCase();
  const entry = PAYMENT_METHOD_LABELS[key];
  if (!entry) return opts?.fallback ?? String(method);
  return entry[locale] ?? entry.he;
}
