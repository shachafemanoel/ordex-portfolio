import { describe, expect, it } from 'vitest';
import {
  tOrderStatus,
  tTask,
  tPayment,
  tPurchaseOrder,
  translate,
} from '@/lib/i18n';

describe('i18n translation layer', () => {
  it('translates canonical order status to Hebrew by default', () => {
    expect(tOrderStatus('TO_DO')).toBe('לביצוע');
    expect(tOrderStatus('COMPLETED')).toBe('הושלם');
  });

  it('falls back safely on unknown order status', () => {
    expect(tOrderStatus('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
    expect(tOrderStatus('UNKNOWN_STATUS', { fallback: 'לא ידוע' })).toBe('לא ידוע');
  });

  it('translates task priority and type', () => {
    expect(tTask('priority', 'URGENT')).toBe('דחוף מאוד');
    expect(tTask('type', 'CALL_BACK')).toBe('שיחה ללקוח');
  });

  it('translates payment status and method', () => {
    expect(tPayment('status', 'PAID')).toBe('שולם');
    expect(tPayment('method', 'CASH')).toBe('מזומן');
  });

  it('translates purchase order status', () => {
    expect(tPurchaseOrder('status', 'RECEIVED')).toBe('התקבל');
  });

  it('supports locale override to English', () => {
    expect(tOrderStatus('TO_DO', { locale: 'en' })).toBe('To Do');
    expect(tTask('priority', 'HIGH', { locale: 'en' })).toBe('High');
    expect(translate('order', 'number', undefined, { locale: 'en' })).toBe('Order Number');
  });
});
