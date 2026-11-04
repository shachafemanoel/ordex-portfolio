'use client';

import { useEffect, useState } from 'react';

/**
 * useTouchDevice – Detects whether the user is on a touch-capable device.
 *
 * Uses a combination of:
 *  - `pointer: coarse` media query (most reliable for modern browsers)
 *  - `ontouchstart` as a fallback
 *
 * Returns `false` on the server to avoid hydration mismatch.
 *
 * @example
 *   const isTouch = useTouchDevice();
 *   // Use to show larger hit-targets, swipe gestures, etc.
 */
export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const check = () => {
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const hasTouchStart = 'ontouchstart' in window;
      setIsTouch(hasCoarsePointer || hasTouchStart);
    };

    check();

    // Re-check if a pointer media query changes (e.g. tablet with external mouse)
    const mql = window.matchMedia('(pointer: coarse)');
    mql.addEventListener('change', check);
    return () => mql.removeEventListener('change', check);
  }, []);

  return isTouch;
}
