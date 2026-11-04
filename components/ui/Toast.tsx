'use client';

import { ReactNode, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

// Re-export toast for direct usage
export { toast };

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  message?: string; // Compatibility
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export type ToastOptions = Partial<Toast>;

// Dummy provider for backward compatibility
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Unified hook wrapping sonner
export const useToast = () => {
  const showToast = useCallback((arg1: any, arg2?: any) => {
    let type = 'info';
    let title = '';
    let description = undefined;
    let action = undefined;
    let duration = undefined;

    // Handle showToast(message, type) signature from hooks/useToast.ts
    if (typeof arg1 === 'string') {
      title = arg1;
      if (typeof arg2 === 'string') {
        type = arg2;
      } else if (typeof arg2 === 'object') {
        // Handle options if passed as second arg
        type = arg2.type || 'info';
        description = arg2.description || arg2.message;
        duration = arg2.duration;
      }
    }
    // Handle showToast(object) signature
    else if (typeof arg1 === 'object') {
      title = arg1.title || arg1.message || '';
      description = arg1.description;
      // If title was used as message (legacy), ensure description is set if separate
      if (!title && arg1.message) title = arg1.message;

      type = arg1.type || 'info';
      action = arg1.action;
      duration = arg1.duration;
    }

    const options = {
      description,
      action: action
        ? {
            label: action.label,
            onClick: action.onClick,
          }
        : undefined,
      duration,
    };

    switch (type) {
      case 'success':
        toast.success(title, options);
        break;
      case 'error':
        toast.error(title, options);
        break;
      case 'warning':
        toast.warning(title, options);
        break;
      case 'info':
        toast.info(title, options);
        break;
      default:
        toast(title, options);
    }
    return 'id'; // Mock ID
  }, []);

  const dismissToast = useCallback((id?: string) => {
    toast.dismiss(id);
  }, []);

  const clearAll = useCallback(() => {
    toast.dismiss();
  }, []);

  // Compatibility helpers
  const success = useCallback(
    (title: string, description?: string) => showToast({ type: 'success', title, description }),
    [showToast]
  );
  const error = useCallback(
    (title: string, description?: string) => showToast({ type: 'error', title, description }),
    [showToast]
  );
  const warning = useCallback(
    (title: string, description?: string) => showToast({ type: 'warning', title, description }),
    [showToast]
  );
  const info = useCallback(
    (title: string, description?: string) => showToast({ type: 'info', title, description }),
    [showToast]
  );

  return useMemo(
    () => ({
      toasts: [],
      showToast,
      dismissToast,
      clearAll,
      success,
      error,
      warning,
      info,
      // Aliases found in code
      toast: showToast,
      dismiss: dismissToast,
      dismissAll: clearAll,
      clear: clearAll, // Found in ToastManager
      addToast: showToast, // Found in ToastProvider
      removeToast: dismissToast, // Found in ToastProvider
    }),
    [showToast, dismissToast, clearAll, success, error, warning, info]
  );
};

export const useSuccessToast = () => {
  const { success } = useToast();
  return success;
};

export const useErrorToast = () => {
  const { error } = useToast();
  return error;
};

export const useWarningToast = () => {
  const { warning } = useToast();
  return warning;
};

export const useInfoToast = () => {
  const { info } = useToast();
  return info;
};
