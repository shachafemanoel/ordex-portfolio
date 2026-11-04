/**
 * Unified Error Handling Utilities
 *
 * Provides consistent error handling across the application with:
 * - Toast notifications
 * - Console logging
 * - Type-safe error extraction
 * - User-friendly error messages
 */

import { useToast } from '@/hooks/useToast';
import type { ApiResponse } from '@/lib/api/types';

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    // Handle API response errors
    if ('error' in error && error.error && typeof error.error === 'object') {
      const apiError = error.error as { message?: string };
      if (apiError.message) {
        return apiError.message;
      }
    }

    // Handle generic object errors
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }

  return 'אירעה שגיאה לא צפויה';
}

/**
 * Log error to console with context
 */
export function logError(context: string, error: unknown, details?: Record<string, unknown>) {
  console.error(`[${context}]`, error, details || '');
}

/**
 * Handle API response errors consistently
 */
export function handleApiError<T>(
  response: ApiResponse<T>,
  context: string,
  fallbackMessage: string = 'הפעולה נכשלה'
): never {
  const message = response.error?.message || fallbackMessage;
  logError(context, message);
  throw new Error(message);
}

/**
 * Hook for unified error handling with toast notifications
 */
export function useErrorHandler() {
  const toast = useToast();

  /**
   * Handle error with toast notification and logging
   */
  const handleError = (
    error: unknown,
    context: string,
    options?: {
      fallbackMessage?: string;
      showToast?: boolean;
      logToConsole?: boolean;
    }
  ) => {
    const {
      fallbackMessage = 'אירעה שגיאה',
      showToast = true,
      logToConsole = true,
    } = options || {};

    const message = getErrorMessage(error);
    const displayMessage = message || fallbackMessage;

    if (logToConsole) {
      logError(context, error);
    }

    if (showToast) {
      toast.error(displayMessage);
    }

    return displayMessage;
  };

  /**
   * Handle API response with automatic error handling
   */
  const handleApiResponse = async <T,>(
    apiCall: () => Promise<ApiResponse<T>>,
    context: string,
    options?: {
      successMessage?: string;
      errorMessage?: string;
      showSuccessToast?: boolean;
    }
  ): Promise<T> => {
    const {
      successMessage,
      errorMessage = 'הפעולה נכשלה',
      showSuccessToast = false,
    } = options || {};

    try {
      const response = await apiCall();

      if (!response.success) {
        throw new Error(response.error?.message || errorMessage);
      }

      if (showSuccessToast && successMessage) {
        toast.success(successMessage);
      }

      return response.data as T;
    } catch (error) {
      handleError(error, context, { fallbackMessage: errorMessage });
      throw error; // Re-throw for React Query
    }
  };

  /**
   * Wrap a mutation function with error handling
   */
  const withErrorHandling = <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    context: string,
    options?: {
      successMessage?: string;
      errorMessage?: string;
      showSuccessToast?: boolean;
    }
  ) => {
    return async (...args: TArgs): Promise<TResult> => {
      const {
        successMessage,
        errorMessage = 'הפעולה נכשלה',
        showSuccessToast = false,
      } = options || {};

      try {
        const result = await fn(...args);

        if (showSuccessToast && successMessage) {
          toast.success(successMessage);
        }

        return result;
      } catch (error) {
        handleError(error, context, { fallbackMessage: errorMessage });
        throw error;
      }
    };
  };

  return {
    handleError,
    handleApiResponse,
    withErrorHandling,
  };
}

/**
 * Standalone error handler for use outside of React components
 */
export const errorHandler = {
  getErrorMessage,
  logError,
  handleApiError,
};

/**
 * Type guard for API response errors
 */
export function isApiError<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: false } {
  return !response.success;
}

/**
 * Common error messages in Hebrew
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'שגיאת רשת - אנא בדוק את החיבור לאינטרנט',
  UNAUTHORIZED: 'אינך מורשה לבצע פעולה זו',
  NOT_FOUND: 'המשאב המבוקש לא נמצא',
  VALIDATION_ERROR: 'הנתונים שהוזנו אינם תקינים',
  SERVER_ERROR: 'שגיאת שרת - אנא נסה שוב מאוחר יותר',
  TIMEOUT: 'הפעולה לקחה זמן רב מדי - אנא נסה שוב',
  UNKNOWN: 'אירעה שגיאה לא צפויה',
} as const;

/**
 * Map HTTP status codes to Hebrew error messages
 */
export function getHttpErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return ERROR_MESSAGES.VALIDATION_ERROR;
    case 401:
    case 403:
      return ERROR_MESSAGES.UNAUTHORIZED;
    case 404:
      return ERROR_MESSAGES.NOT_FOUND;
    case 408:
      return ERROR_MESSAGES.TIMEOUT;
    case 500:
    case 502:
    case 503:
      return ERROR_MESSAGES.SERVER_ERROR;
    default:
      return ERROR_MESSAGES.UNKNOWN;
  }
}
