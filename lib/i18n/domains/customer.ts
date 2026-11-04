import type { TranslateOptions } from '@/lib/i18n/types';

const CUSTOMER_FIELD_LABELS: Record<string, { he: string; en: string }> = {
  name: { he: 'שם', en: 'Name' },
  email: { he: 'אימייל', en: 'Email' },
  phone: { he: 'טלפון', en: 'Phone' },
  address: { he: 'כתובת', en: 'Address' },
  city: { he: 'עיר', en: 'City' },
  notes: { he: 'הערות', en: 'Notes' },
};

export function translateCustomerField(field: string, opts?: TranslateOptions): string {
  const locale = opts?.locale ?? 'he';
  const key = String(field);
  const entry = CUSTOMER_FIELD_LABELS[key];
  if (!entry) return opts?.fallback ?? key;
  return entry[locale] ?? entry.he;
}
