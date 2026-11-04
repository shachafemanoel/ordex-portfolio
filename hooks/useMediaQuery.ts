'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/**
 * useMediaQuery – SSR-safe media-query hook.
 *
 * Returns `true` when the viewport matches the given CSS media query string.
 * Falls back to `false` during SSR / first render to avoid hydration mismatch.
 *
 * @example
 *   const isMobile  = useMediaQuery('(max-width: 767px)');
 *   const isTablet   = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
 *   const isDesktop  = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Convenience aliases for the standard OrdeX breakpoints. */
export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)');
}

export function useIsTablet() {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)');
}
