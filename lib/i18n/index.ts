import { translate } from '@/lib/i18n/translate';
import type { Locale, TranslateOptions, TranslationDomain } from '@/lib/i18n/types';

export { translate };
export type { Locale, TranslateOptions, TranslationDomain };

export const tOrder = (
  key: string,
  value?: unknown,
  opts?: { locale?: Locale; fallback?: string }
) => translate('order', key, value, opts);

export const tOrderStatus = (status: string, opts?: { locale?: Locale; fallback?: string }) =>
  translate('orderStatus', status, status, opts);

export const tTask = (
  key: 'priority' | 'type',
  value: string,
  opts?: { locale?: Locale; fallback?: string }
) => translate('task', key, value, opts);

export const tPayment = (
  key: 'status' | 'method',
  value: string,
  opts?: { locale?: Locale; fallback?: string }
) => translate('payment', key, value, opts);

export const tPurchaseOrder = (
  key: 'status',
  value: string,
  opts?: { locale?: Locale; fallback?: string }
) => translate('purchaseOrder', key, value, opts);

export const tCustomer = (key: string, opts?: { locale?: Locale; fallback?: string }) =>
  translate('customer', key, undefined, opts);

export const tUI = (key: string, opts?: { locale?: Locale; fallback?: string }) =>
  translate('ui', key, undefined, opts);

export const tAPI = (key: string, opts?: { locale?: Locale; fallback?: string }) =>
  translate('api', key, undefined, opts);
