'use client';
import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorStateProps {
  error: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  showIcon?: boolean;
  variant?: 'default' | 'minimal' | 'inline';
  className?: string;
}

export function ErrorState({
  error,
  title = 'שגיאה',
  onRetry,
  retryLabel = 'נסה שוב',
  showIcon = true,
  variant = 'default',
  className = '',
}: ErrorStateProps) {
  const isAuthError = /unauthorized|authentication required|token/i.test(error);
  const handleLogin = () => {
    const returnTo = typeof window !== 'undefined' ? window.location.pathname : '/';
    window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  };
  if (variant === 'minimal') {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-red-600 text-sm">{error}</p>
        {isAuthError ? (
          <Button variant="outline" size="sm" onClick={handleLogin} className="mt-2">
            התחברות
          </Button>
        ) : onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={`flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}
      >
        <div className="flex items-center">
          {showIcon && <span className="text-red-500 text-lg ml-2">⚠️</span>}
          <span className="text-red-700 text-sm">{error}</span>
        </div>
        {isAuthError ? (
          <Button variant="outline" size="sm" onClick={handleLogin}>
            התחברות
          </Button>
        ) : onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Card className={`border-red-200 ${className}`}>
      <CardContent className="p-6 text-center">
        {showIcon && <div className="text-red-600 text-4xl mb-4">❌</div>}
        <h3 className="text-lg font-semibold text-red-800 mb-2">{title}</h3>
        <p className="text-red-600 mb-4">{error}</p>
        {isAuthError ? (
          <Button onClick={handleLogin} variant="outline">
            התחברות
          </Button>
        ) : onRetry ? (
          <Button onClick={onRetry} variant="outline">
            {retryLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

// Hook for consistent error handling
export function useErrorHandler() {
  const [error, setError] = React.useState<string | null>(null);

  const handleError = React.useCallback((error: unknown) => {
    if (error instanceof Error) {
      setError(error.message);
    } else if (typeof error === 'string') {
      setError(error);
    } else {
      setError('אירעה שגיאה לא צפויה');
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
}
