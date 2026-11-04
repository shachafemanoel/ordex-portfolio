import type { TranslateOptions } from '@/lib/i18n/types';

const PRIORITY_LABELS: Record<string, { he: string; en: string }> = {
  URGENT: { he: 'דחוף מאוד', en: 'Urgent' },
  HIGH: { he: 'גבוה', en: 'High' },
  MEDIUM: { he: 'בינוני', en: 'Medium' },
  LOW: { he: 'נמוך', en: 'Low' },
};

const TASK_TYPE_LABELS: Record<string, { he: string; en: string }> = {
  CALL_BACK: { he: 'שיחה ללקוח', en: 'Call customer' },
  INSTALL_REMINDER: { he: 'תזכורת התקנה', en: 'Install reminder' },
  STOCK_RECEIPT: { he: 'קליטת מלאי', en: 'Stock receipt' },
  OTHER: { he: 'משימה כללית', en: 'General task' },
};

export function translateTaskPriority(priority?: string | null, opts?: TranslateOptions): string {
  if (!priority) return opts?.fallback ?? 'ללא עדיפות';
  const locale = opts?.locale ?? 'he';
  const key = String(priority).toUpperCase();
  const entry = PRIORITY_LABELS[key];
  if (!entry) return opts?.fallback ?? String(priority);
  return entry[locale] ?? entry.he;
}

export function translateTaskType(type?: string | null, opts?: TranslateOptions): string {
  if (!type) return opts?.fallback ?? 'משימה';
  const locale = opts?.locale ?? 'he';
  const key = String(type).toUpperCase();
  const entry = TASK_TYPE_LABELS[key];
  if (!entry) return opts?.fallback ?? String(type);
  return entry[locale] ?? entry.he;
}
