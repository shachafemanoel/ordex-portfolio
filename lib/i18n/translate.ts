import { translateAPI } from '@/lib/i18n/domains/api';
import { translateCustomerField } from '@/lib/i18n/domains/customer';
import { translateOrderField } from '@/lib/i18n/domains/order';
import { translateOrderStatus } from '@/lib/i18n/domains/orderStatus';
import { translatePaymentMethod, translatePaymentStatus } from '@/lib/i18n/domains/payment';
import { translatePurchaseOrderStatus } from '@/lib/i18n/domains/purchaseOrder';
import { translateTaskPriority, translateTaskType } from '@/lib/i18n/domains/task';
import { translateUI } from '@/lib/i18n/domains/ui';
import type { TranslateOptions, TranslationDomain } from '@/lib/i18n/types';

type TranslatorFn = (key: string, value?: unknown, opts?: TranslateOptions) => string;

const translators: Record<TranslationDomain, TranslatorFn> = {
  order: (key, _value, opts) => translateOrderField(key, opts),
  orderStatus: (key, _value, opts) => translateOrderStatus(key, opts),
  task: (key, value, opts) => {
    if (key === 'priority') return translateTaskPriority(String(value ?? key), opts);
    if (key === 'type') return translateTaskType(String(value ?? key), opts);
    return opts?.fallback ?? String(value ?? key);
  },
  payment: (key, value, opts) => {
    if (key === 'status') return translatePaymentStatus(String(value ?? key), opts);
    if (key === 'method') return translatePaymentMethod(String(value ?? key), opts);
    return opts?.fallback ?? String(value ?? key);
  },
  purchaseOrder: (key, value, opts) => {
    if (key === 'status') return translatePurchaseOrderStatus(String(value ?? key), opts);
    return opts?.fallback ?? String(value ?? key);
  },
  customer: (key, _value, opts) => translateCustomerField(key, opts),
  ui: (key, _value, opts) => translateUI(key, opts),
  api: (key, _value, opts) => translateAPI(key, opts),
};

export function translate(
  domain: TranslationDomain,
  key: string,
  value?: unknown,
  opts?: TranslateOptions
): string {
  const translator = translators[domain];
  if (!translator) return opts?.fallback ?? String(value ?? key);
  return translator(key, value, opts);
}
