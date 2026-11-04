'use client';

import {
  useCallback,
  useRef,
  useState,
  type MutableRefObject,
  type SyntheticEvent,
} from 'react';

interface UseModalOptions {
  defaultOpen?: boolean;
}

interface UseModalResult {
  isOpen: boolean;
  open: (event?: SyntheticEvent<HTMLElement>) => void;
  close: () => void;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  triggerRef: MutableRefObject<HTMLElement | null>;
}

/**
 * useModal provides a tiny state machine for toggling dialogs
 * while keeping track of the element that opened the modal so that
 * focus can be restored when the dialog closes.
 */
export function useModal(options: UseModalOptions = {}): UseModalResult {
  const { defaultOpen = false } = options;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((event?: SyntheticEvent<HTMLElement>) => {
    if (event?.currentTarget instanceof HTMLElement) {
      triggerRef.current = event.currentTarget;
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setIsOpen(next);
  }, []);

  return { isOpen, open, close, toggle, setOpen, triggerRef };
}
