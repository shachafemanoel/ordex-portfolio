'use client';

/**
 * ARIA Live Region Component
 *
 * Provides accessible announcements for dynamic content updates.
 * Screen readers will announce changes to users automatically.
 *
 * Usage:
 * - 'polite': Waits for user to finish current task (default)
 * - 'assertive': Interrupts immediately (use sparingly for critical alerts)
 *
 * WCAG 2.1 AA Compliance:
 * - 4.1.3 Status Messages
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface LiveRegionContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const LiveRegionContext = createContext<LiveRegionContextType | null>(null);

interface LiveRegionProviderProps {
  children: React.ReactNode;
}

export function LiveRegionProvider({ children }: LiveRegionProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set message based on priority
    if (priority === 'assertive') {
      setAssertiveMessage(message);
      // Clear after announcement
      timeoutRef.current = setTimeout(() => setAssertiveMessage(''), 1000);
    } else {
      setPoliteMessage(message);
      // Clear after announcement
      timeoutRef.current = setTimeout(() => setPoliteMessage(''), 1000);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <LiveRegionContext.Provider value={{ announce }}>
      {children}

      {/* Polite live region - waits for user to finish current task */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>

      {/* Assertive live region - interrupts immediately */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </LiveRegionContext.Provider>
  );
}

/**
 * Hook to access the live region announcement function
 *
 * @example
 * const { announce } = useLiveRegion();
 * announce('Order created successfully');
 * announce('Critical error occurred', 'assertive');
 */
export function useLiveRegion() {
  const context = useContext(LiveRegionContext);

  if (!context) {
    throw new Error('useLiveRegion must be used within a LiveRegionProvider');
  }

  return context;
}

/**
 * Standalone live region for simple use cases
 * Use this when you don't need the context provider
 */
interface StandaloneLiveRegionProps {
  message: string;
  priority?: 'polite' | 'assertive';
}

export function StandaloneLiveRegion({
  message,
  priority = 'polite',
}: StandaloneLiveRegionProps) {
  return (
    <div
      role={priority === 'assertive' ? 'alert' : 'status'}
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

export default LiveRegionProvider;
