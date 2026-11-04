'use client';

import React from 'react';
import { logger, trackError } from '@/lib/logger';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; reset?: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ErrorBoundaryClass extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Enhanced logging with context
    logger.error('React Error Boundary triggered', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      severity: 'critical',
    });

    // Track error for external monitoring
    trackError(error, {
      component: 'ErrorBoundary',
      componentStack: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} reset={this.handleReset} />;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          reset={this.handleReset}
          errorInfo={this.state.errorInfo}
        />
      );
    }

    return this.props.children;
  }
}

// Default error fallback component
function DefaultErrorFallback({
  error,
  reset,
  errorInfo,
}: {
  error?: Error;
  reset?: () => void;
  errorInfo?: React.ErrorInfo;
}) {
  return (
    <Card className="p-8 m-4 border-red-200 bg-red-50">
      <div className="text-center">
        <div className="text-6xl text-red-500 mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-red-800 mb-4">משהו השתבש</h2>
        <p className="text-red-700 mb-6">
          אירעה שגיאה בלתי צפויה. אנא נסה שוב או פנה לתמיכה טכנית.
        </p>

        {error && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-red-600 hover:text-red-800 mb-2">
              פרטים טכניים (לחץ להרחבה)
            </summary>
            <div className="bg-red-100 p-4 rounded text-sm font-mono text-red-800 whitespace-pre-wrap overflow-auto max-h-40">
              <div className="font-bold mb-2">Error:</div>
              {error.message}
              {error.stack && (
                <>
                  <div className="font-bold mt-4 mb-2">Stack Trace:</div>
                  {error.stack}
                </>
              )}
              {errorInfo?.componentStack && (
                <>
                  <div className="font-bold mt-4 mb-2">Component Stack:</div>
                  {errorInfo.componentStack}
                </>
              )}
            </div>
          </details>
        )}

        <div className="flex gap-4 justify-center">
          <Button onClick={reset} variant="primary">
            נסה שוב
          </Button>
          <Button onClick={() => window.location.reload()} variant="secondary">
            רענן דף
          </Button>
          <Button onClick={() => (window.location.href = '/dashboard')} variant="secondary">
            חזור לראשי
          </Button>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p>אם הבעיה נמשכת, אנא פנה לתמיכה טכנית עם פרטי השגיאה המוצגים למעלה.</p>
        </div>
      </div>
    </Card>
  );
}

// Simple error fallback for smaller components
export function SimpleErrorFallback({ error, reset }: { error?: Error; reset?: () => void }) {
  return (
    <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-red-500">⚠️</span>
        <div className="flex-1">
          <p className="text-red-800 font-medium">שגיאה בטעינת הרכיב</p>
          {error && <p className="text-red-600 text-sm">{error.message}</p>}
        </div>
        {reset && (
          <Button size="sm" variant="secondary" onClick={reset}>
            נסה שוב
          </Button>
        )}
      </div>
    </div>
  );
}

// HOC for functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundaryClass {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundaryClass>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Main export
export const ErrorBoundary = ErrorBoundaryClass;
