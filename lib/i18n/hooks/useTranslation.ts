'use client';

import { useLocale } from '@/contexts/I18nContext';
import { translate } from '@/lib/i18n/translate';
import type { Locale, TranslateOptions, TranslationDomain } from '@/lib/i18n/types';

/**
 * React hook for translations in components
 * Provides a simple `t()` function for translating strings
 *
 * @param domain - Translation domain (default: 'ui')
 * @returns Object with `t` function and current locale
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t } = useTranslation();
 *   return <h1>{t('dashboard.welcome')}</h1>;
 * }
 * ```
 */
export function useTranslation(domain: TranslationDomain = 'ui') {
  const { locale, direction, setLocale } = useLocale();

  const t = (key: string, value?: unknown, opts?: Omit<TranslateOptions, 'locale'>) => {
    return translate(domain, key, value, { locale, ...opts });
  };

  return {
    t,
    locale: locale as Locale,
    direction,
    setLocale,
  };
}

/**
 * Specialized hook for UI translations (most common use case)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t } = useUITranslation();
 *   return <button>{t('common.save')}</button>;
 * }
 * ```
 */
export function useUITranslation() {
  return useTranslation('ui');
}
