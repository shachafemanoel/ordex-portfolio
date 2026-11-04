'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Thin top-of-page progress bar that fires on every route change.
 * No external dependencies — pure CSS animation.
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevRouteRef = useRef(`${pathname}${searchParams}`);

  useEffect(() => {
    const currentRoute = `${pathname}${searchParams}`;

    if (currentRoute === prevRouteRef.current) return;
    prevRouteRef.current = currentRoute;

    // Clear any running timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);

    // Start the bar
    setProgress(15);
    setVisible(true);

    // Fake progress increments
    let current = 15;
    timerRef.current = setInterval(() => {
      if (current < 85) {
        // Slow down as we approach 85%
        const increment = current < 50 ? 8 : current < 70 ? 4 : 1;
        current = Math.min(current + increment, 85);
        setProgress(current);
      }
    }, 150);

    // Complete after a short delay (page has rendered)
    completeTimerRef.current = setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(100);
      // Hide bar after completion animation
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 400);
    }, 600);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, [pathname, searchParams]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] pointer-events-none"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-gradient-to-r from-primary-500 to-primary-600 shadow-[0_0_8px_rgba(0,133,255,0.6)]"
        style={{
          width: `${progress}%`,
          transition: progress === 100
            ? 'width 0.2s ease-out, opacity 0.3s ease 0.1s'
            : 'width 0.15s ease-out',
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
