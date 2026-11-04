/**
 * Widget Error Boundary - Error boundary ממוקד לווידג׳טים בודדים
 *
 * שימוש:
 * <WidgetErrorBoundary widgetName="טבלת הזמנות" onReset={handleReset}>
 *   <OrdersTable />
 * </WidgetErrorBoundary>
 *
 * Features:
 * - Fallback UI מותאם אישית
 * - כפתור "נסה שוב" עם reset callback
 * - Logging אוטומטי לשגיאות
 * - תמיכה ב-RTL
 */

'use client';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import { Component, type ReactNode } from 'react';

interface WidgetErrorBoundaryProps {
  children: ReactNode;
  /** שם הווידג׳ט להצגה בהודעת שגיאה */
  widgetName: string;
  /** Fallback UI מותאם אישית (אופציונלי) */
  fallback?: ReactNode;
  /** Callback לטיפול ב-reset (אופציונלי) */
  onReset?: () => void;
  /** האם להציג פרטי שגיאה מפורטים (רק ב-development) */
  showDetails?: boolean;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any | null;
}

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<WidgetErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error with context
    logger.error(`Widget Error [${this.props.widgetName}]:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      widgetName: this.props.widgetName,
      timestamp: new Date().toISOString(),
    });

    this.setState({ errorInfo });

    // Send to monitoring service (Sentry, etc.)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: {
          widget: this.props.widgetName,
          boundary: 'WidgetErrorBoundary',
        },
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call custom reset handler
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      const isDevelopment = process.env.NODE_ENV === 'development';
      const showDetails = this.props.showDetails ?? isDevelopment;

      return (
        <Card className="border-red-200 bg-red-50" role="alert" aria-live="assertive">
          <CardContent className="p-6">
            <div className="flex items-start gap-4" dir="rtl">
              {/* Error Icon */}
              <div className="flex-shrink-0 rounded-full bg-red-100 p-3">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              {/* Error Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  שגיאה בטעינת {this.props.widgetName}
                </h3>

                <p className="text-sm text-red-700 mb-4">
                  {this.state.error?.message || 'אירעה שגיאה בלתי צפויה'}
                </p>

                {/* Detailed error info (development only) */}
                {showDetails && this.state.error && (
                  <details className="mb-4 text-xs">
                    <summary className="cursor-pointer font-medium text-red-800 hover:text-red-900 mb-2">
                      פרטים טכניים
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-red-100 p-3 text-left text-red-900">
                      {this.state.error.stack}
                    </pre>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="mt-2 overflow-auto rounded bg-red-100 p-3 text-left text-red-900">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </details>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={this.handleReset}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    נסה שוב
                  </Button>

                  {isDevelopment && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        console.error('Error Details:', {
                          error: this.state.error,
                          errorInfo: this.state.errorInfo,
                        });
                      }}
                      className="text-red-700 hover:bg-red-100"
                    >
                      הצג ב-Console
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook wrapper for functional components (experimental)
 * Note: Error boundaries must be class components, but this provides a cleaner API
 */
export function useErrorBoundary(widgetName: string, onReset?: () => void) {
  return {
    ErrorBoundary: ({ children }: { children: ReactNode }) => (
      <WidgetErrorBoundary widgetName={widgetName} onReset={onReset}>
        {children}
      </WidgetErrorBoundary>
    ),
  };
}
