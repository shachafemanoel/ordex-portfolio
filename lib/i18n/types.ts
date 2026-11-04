export type Locale = 'he' | 'en';

export type TranslationDomain =
  | 'order'
  | 'orderStatus'
  | 'task'
  | 'payment'
  | 'purchaseOrder'
  | 'customer'
  | 'ui'
  | 'api';

export interface TranslateOptions {
  locale?: Locale;
  fallback?: string;
  params?: Record<string, string | number>;
}
