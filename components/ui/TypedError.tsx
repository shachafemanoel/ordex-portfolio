'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface TypedErrorProps {
  title: string;
  message: string;
  description?: string;
  errorCode?: string;
  correlationId?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  onBack?: () => void;
  supportHref?: string;
  supportLabel?: string;
  className?: string;
}

/**
 * Presents consistent, typed error states with correlation identifiers for support.
 */
export function TypedError({
  title,
  message,
  description,
  errorCode,
  correlationId,
  onRetry,
  retryLabel = 'נסה שוב',
  onBack,
  supportHref,
  supportLabel = 'צור קשר עם התמיכה',
  className,
}: TypedErrorProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  return (
    <Card className={cn('border-red-200 bg-red-50/40', className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center justify-between text-red-800">
          <span>{title}</span>
          <span aria-hidden className="text-3xl">
            ⚠️
          </span>
        </CardTitle>
        <p className="text-sm text-red-700">{message}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && <p className="text-sm text-red-800/90 leading-relaxed">{description}</p>}

        {(errorCode || correlationId) && (
          <details
            open={showDetails}
            className="rounded-lg border border-red-200 bg-white/70 p-4 text-sm text-gray-700"
            onToggle={(event) => setShowDetails((event.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer select-none text-red-800">פרטי שגיאה טכניים</summary>
            <div className="mt-2 space-y-1 text-xs">
              {errorCode && (
                <div>
                  <span className="font-semibold text-gray-600">קוד שגיאה:</span>{' '}
                  <span className="font-mono text-gray-800">{errorCode}</span>
                </div>
              )}
              {correlationId && (
                <div>
                  <span className="font-semibold text-gray-600">Correlation ID:</span>{' '}
                  <span className="font-mono text-gray-800 break-all">{correlationId}</span>
                </div>
              )}
            </div>
          </details>
        )}

        <div className="flex flex-wrap gap-3">
          {onRetry && (
            <Button onClick={onRetry} variant="primary">
              {retryLabel}
            </Button>
          )}
          <Button variant="outline" onClick={handleBack}>
            חזרה
          </Button>
          {supportHref && (
            <Button
              variant="ghost"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(supportHref, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              {supportLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
