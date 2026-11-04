'use client';

import type { Locale } from '@/lib/i18n/types';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Direction = 'rtl' | 'ltr';

interface I18nContextValue {
  locale: Locale;
  direction: Direction;
  setLocale: (next: Locale) => void;
}

const STORAGE_KEY = 'ordex.locale';

const LOCALE_TO_DIR: Record<Locale, Direction> = {
  he: 'rtl',
  en: 'ltr',
};

const I18nContext = createContext<I18nContextValue | null>(null);

function safeReadStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'he' || raw === 'en') return raw;
  return null;
}

function applyDocumentDirection(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = LOCALE_TO_DIR[locale];
}

export function I18nProvider({
  children,
  defaultLocale = 'he',
}: {
  children: React.ReactNode;
  defaultLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const stored = safeReadStoredLocale();
    if (stored) {
      setLocaleState(stored);
      applyDocumentDirection(stored);
      return;
    }
    applyDocumentDirection(defaultLocale);
  }, [defaultLocale]);

  useEffect(() => {
    applyDocumentDirection(locale);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction: LOCALE_TO_DIR[locale],
      setLocale: setLocaleState,
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      locale: 'he' as Locale,
      direction: 'rtl' as Direction,
      setLocale: (_next: Locale) => {},
    };
  }
  return context;
}
