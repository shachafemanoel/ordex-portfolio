import type { NextSuggestion } from '@/lib/assistant/uiPayloadSchema';

export const DEFAULT_ACTION_SUGGESTIONS: NextSuggestion[] = [
  {
    id: 'reports.status_dashboard',
    label: '📊 סטטוס הזמנות',
    paramsHint: {},
  },
  {
    id: 'reports.pending_goods_receipt',
    label: '📦 ממתינים לקבלת סחורה',
    paramsHint: {},
  },
  {
    id: 'reports.pending_installations',
    label: '🛠️ התקנות ממתינות',
    paramsHint: {},
  },
  {
    id: 'map.orders_by_status',
    label: '🗺️ מפה לפי סטטוס',
    paramsHint: { status: ['READY_FOR_INSTALL', 'SCHEDULED'] },
  },
  {
    id: 'orders.set_status',
    label: '🔄 עדכון סטטוס להזמנה',
    paramsHint: { newStatus: 'READY_FOR_INSTALL' },
  },
  {
    id: 'reports.historical_orders',
    label: '🗂️ היסטוריית הזמנות',
    paramsHint: { months: 6 },
  },
  {
    id: 'reminders.send_day_before',
    label: '⏰ שלח תזכורות יום לפני',
    paramsHint: { date: 'tomorrow' },
  },
];
