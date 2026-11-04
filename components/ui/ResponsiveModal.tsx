'use client';

import { type ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer';
import { Modal, type ModalSize } from '@/components/ui/Modal';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { X } from 'lucide-react';

/**
 * ResponsiveModal - Adaptive modal component
 *
 * Displays as:
 * - Drawer on mobile (< 768px) - slides from bottom
 * - Modal on desktop (>= 768px) - centered overlay modal
 *
 * Provides unified interface for both mobile and desktop experiences.
 *
 * @example
 * ```tsx
 * <ResponsiveModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="פרטי הזמנה"
 * >
 *   <OrderDetails />
 * </ResponsiveModal>
 * ```
 */

export interface ResponsiveModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal content */
  children: ReactNode;
  /** Max width for desktop modal (sm, md, lg, xl, 2xl, 4xl) */
  maxWidth?: ModalSize;
  /** Show close button (default: true) */
  showCloseButton?: boolean;
  /** Close on overlay/backdrop click (default: true) */
  closeOnOverlayClick?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Reference to element that should receive focus */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** ARIA described-by ID */
  ariaDescribedBy?: string;
}

export function ResponsiveModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className,
  initialFocusRef,
  ariaDescribedBy,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  // Mobile: Use Drawer (bottom-sheet) for comfortable touch interaction
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent
          side="bottom"
          dir="rtl"
          className="max-h-[92dvh] rounded-t-2xl p-0"
          onInteractOutside={(event) => {
            if (!closeOnOverlayClick) {
              event.preventDefault();
            }
          }}
        >
          <DrawerHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 text-right">
            {/* Pull-bar handle for touch affordance */}
            <div className="mb-2 flex justify-center">
              <div className="h-1.5 w-12 rounded-full bg-slate-300" />
            </div>

            <div className="flex items-center justify-between gap-3">
              <DrawerTitle className="text-base font-bold text-slate-900 truncate flex-1 min-w-0">
                {title}
              </DrawerTitle>
              {showCloseButton ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 touch-manipulation shrink-0"
                  aria-label="סגירה"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          </DrawerHeader>

          <div className="max-h-[calc(92dvh-80px)] overflow-y-auto overscroll-contain p-4 pb-8">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Use Modal
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth={maxWidth}
      showCloseButton={showCloseButton}
      closeOnOverlayClick={closeOnOverlayClick}
      className={className}
      initialFocusRef={initialFocusRef}
      ariaDescribedBy={ariaDescribedBy}
    >
      {children}
    </Modal>
  );
}

// Export type for external use
export type { ModalSize };
