'use client';

import { useCallback, useRef } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeGestureOptions {
  /** Minimum swipe distance in px to trigger (default: 50) */
  threshold?: number;
  /** Maximum time in ms for swipe gesture (default: 300) */
  maxTime?: number;
  /** Callback when a swipe is detected */
  onSwipe: (direction: SwipeDirection) => void;
  /** Optional: only trigger for specific directions */
  directions?: SwipeDirection[];
}

/**
 * useSwipeGesture – Detects swipe gestures on a touch element.
 *
 * Returns touch event handlers to spread onto a target element.
 * Respects direction filtering and configurable thresholds.
 *
 * @example
 * ```tsx
 * const swipeHandlers = useSwipeGesture({
 *   onSwipe: (dir) => {
 *     if (dir === 'left') goNext();
 *     if (dir === 'right') goPrev();
 *   },
 *   directions: ['left', 'right'],
 * });
 *
 * return <div {...swipeHandlers}>content</div>;
 * ```
 */
export function useSwipeGesture({
  threshold = 50,
  maxTime = 300,
  onSwipe,
  directions,
}: SwipeGestureOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startTime.current = Date.now();
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;
      const dt = Date.now() - startTime.current;

      if (dt > maxTime) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Must exceed threshold in at least one axis
      if (absDx < threshold && absDy < threshold) return;

      let direction: SwipeDirection;

      if (absDx > absDy) {
        // Horizontal swipe
        direction = dx > 0 ? 'right' : 'left';
      } else {
        // Vertical swipe
        direction = dy > 0 ? 'down' : 'up';
      }

      // Filter if specific directions requested
      if (directions && !directions.includes(direction)) return;

      onSwipe(direction);
    },
    [threshold, maxTime, onSwipe, directions]
  );

  return {
    onTouchStart,
    onTouchEnd,
  };
}
