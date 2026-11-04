'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const safeFocus = (element?: HTMLElement | null) => {
  if (!element) {
    return;
  }

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
};

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: ModalSize;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
  initialFocusRef?: React.RefObject<HTMLElement>;
  ariaDescribedBy?: string;
}

/** Minimum swipe distance (px) to trigger close. */
const SWIPE_CLOSE_THRESHOLD = 80;

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = '',
  initialFocusRef,
  ariaDescribedBy,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const internalTitleId = useId();
  const titleId = `modal-${internalTitleId}`;

  // Swipe-to-close state for mobile bottom-sheet style
  const touchStartY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const dialogNode = dialogRef.current;
    const focusCandidate =
      initialFocusRef?.current ??
      dialogNode?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      dialogNode;

    const timer = window.setTimeout(() => {
      safeFocus(focusCandidate);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen, initialFocusRef]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const dialogNode = dialogRef.current;
      if (!dialogNode) {
        return;
      }

      const focusable = Array.from(
        dialogNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden')
      );

      if (focusable.length === 0) {
        event.preventDefault();
        safeFocus(dialogNode);
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (current === first || current === dialogNode) {
          event.preventDefault();
          safeFocus(last);
        }
      } else if (current === last) {
        event.preventDefault();
        safeFocus(first);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!closeOnOverlayClick) {
        return;
      }

      if (event.target === overlayRef.current) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  // Swipe-to-dismiss handlers (mobile bottom-sheet pattern)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only capture swipe if at scroll-top (prevents conflict with inner scroll)
    const dialogNode = dialogRef.current;
    if (dialogNode && dialogNode.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    // Only allow downward swipe
    if (delta > 0) {
      setSwipeOffset(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeOffset > SWIPE_CLOSE_THRESHOLD) {
      onClose();
    }
    setSwipeOffset(0);
    touchStartY.current = null;
  }, [swipeOffset, onClose]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    if (lastFocusedElementRef.current) {
      safeFocus(lastFocusedElementRef.current);
      lastFocusedElementRef.current = null;
    }
  }, [isOpen]);

  if (!mounted || !isOpen) {
    return null;
  }

  const portalRoot = document.getElementById('modal-portal-root');
  if (!portalRoot) {
    console.error('Modal portal root not found');
    return null;
  }

  const maxWidthClasses: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  };

  const modalContent = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4 md:p-8"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        data-app-modal=""
        aria-labelledby={titleId}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        dir="rtl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: swipeOffset > 0 ? `translateY(${swipeOffset}px)` : undefined,
          transition: swipeOffset > 0 ? 'none' : 'transform 0.3s ease',
          opacity: swipeOffset > 0 ? Math.max(0.5, 1 - swipeOffset / 400) : 1,
        }}
        className={cn(
          // Base
          'relative w-full bg-white text-right shadow-xl outline-none',
          // Mobile: bottom-sheet style, full-width, rounded top
          'rounded-t-2xl p-4 pb-6',
          'max-h-[92dvh]',
          // Desktop: centered card, all-rounded, larger padding
          'sm:rounded-2xl sm:p-6 sm:max-h-[calc(100vh-4rem)]',
          // Scrolling
          'overflow-y-auto overscroll-contain',
          maxWidthClasses[maxWidth],
          className
        )}
      >
        {/* Pull-bar indicator on mobile */}
        <div className="flex justify-center mb-3 sm:hidden">
          <div className="pull-bar" />
        </div>

        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="space-y-1 flex-1 min-w-0">
            <h2 id={titleId} className="text-lg sm:text-xl font-bold text-text-primary truncate">
              {title}
            </h2>
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-background-light text-text-secondary transition-colors hover:bg-slate-100 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0 touch-manipulation"
              aria-label="סגירת חלון"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        <div className="mt-2 text-sm sm:text-base text-text-secondary">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, portalRoot);
}
