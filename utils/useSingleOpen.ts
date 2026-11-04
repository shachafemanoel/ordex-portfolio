import { useRef, useCallback } from 'react';

/**
 * Hook to prevent duplicate modal opens within the same tick
 * Deduplicates rapid successive calls to open a modal
 */
export function useSingleOpen() {
  const pendingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const guardedOpen = useCallback((openFn: () => void) => {
    // If already pending, ignore this call
    if (pendingRef.current) {
      console.warn('[useSingleOpen] Duplicate open call prevented');
      return;
    }

    // Mark as pending
    pendingRef.current = true;

    // Execute the open function
    openFn();

    // Clear the pending flag after a small delay
    // This prevents multiple rapid clicks from opening duplicates
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      pendingRef.current = false;
    }, 100);
  }, []);

  return guardedOpen;
}
