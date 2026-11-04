'use client';

import { useCallback, useRef } from 'react';

export interface LongPressOptions {
  /** Duration in ms before long-press triggers (default: 500) */
  duration?: number;
  /** Callback when long-press is detected */
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
  /** Optional callback for normal taps (fires only if not a long-press) */
  onTap?: () => void;
  /** Movement tolerance in px before cancelling (default: 10) */
  moveTolerance?: number;
}

/**
 * useLongPress – Detects long-press (press-and-hold) gestures.
 *
 * Works with both touch and mouse events. Cancels if the user
 * moves their finger/cursor beyond the tolerance threshold.
 *
 * @example
 * ```tsx
 * const longPressHandlers = useLongPress({
 *   onLongPress: () => setContextMenuOpen(true),
 *   onTap: () => handleClick(),
 *   duration: 600,
 * });
 *
 * return <div {...longPressHandlers}>Hold me</div>;
 * ```
 */
export function useLongPress({
  duration = 500,
  onLongPress,
  onTap,
  moveTolerance = 10,
}: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      didLongPress.current = false;
      const touch = e.touches[0];
      startPos.current = { x: touch.clientX, y: touch.clientY };

      timerRef.current = setTimeout(() => {
        didLongPress.current = true;
        onLongPress(e);
      }, duration);
    },
    [duration, onLongPress]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startPos.current.x);
      const dy = Math.abs(touch.clientY - startPos.current.y);

      if (dx > moveTolerance || dy > moveTolerance) {
        clearTimer();
      }
    },
    [moveTolerance, clearTimer]
  );

  const onTouchEnd = useCallback(() => {
    clearTimer();
    if (!didLongPress.current) {
      onTap?.();
    }
  }, [clearTimer, onTap]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      didLongPress.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };

      timerRef.current = setTimeout(() => {
        didLongPress.current = true;
        onLongPress(e);
      }, duration);
    },
    [duration, onLongPress]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);

      if (dx > moveTolerance || dy > moveTolerance) {
        clearTimer();
      }
    },
    [moveTolerance, clearTimer]
  );

  const onMouseUp = useCallback(() => {
    clearTimer();
    if (!didLongPress.current) {
      onTap?.();
    }
  }, [clearTimer, onTap]);

  const onMouseLeave = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  // Prevent context menu on long-press (let our handler manage it)
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (didLongPress.current) {
      e.preventDefault();
    }
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onContextMenu,
  };
}
