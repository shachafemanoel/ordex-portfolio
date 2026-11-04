/**
 * Section Error Boundary Component
 *
 * Provides graceful error handling for page sections with RTL support.
 * Displays user-friendly error messages while allowing other sections to continue working.
 */

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';

interface SectionErrorBoundaryProps {
  /** Display name for the section (e.g., "Order Details", "Payment Summary") */
  sectionName: string;
  /** Content to render */
  children: React.ReactNode;
  /** Optional callback when error occurs */
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

function SectionErrorFallback({
  error,
  resetErrorBoundary,
  sectionName,
}: FallbackProps & { sectionName: string }) {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-6 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl" role="img" aria-label="Error">
            ⚠️
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-800">שגיאה בטעינת {sectionName}</h3>
            <p className="text-sm text-red-600 mt-1">{errorObj.message || 'אירעה שגיאה בלתי צפויה'}</p>
            {process.env.NODE_ENV === 'development' && errorObj.stack && (
              <details className="mt-2 text-xs text-red-700">
                <summary className="cursor-pointer">פרטים טכניים</summary>
                <pre className="mt-2 overflow-auto p-2 bg-red-100 rounded">{errorObj.stack}</pre>
              </details>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={resetErrorBoundary}
            className="text-red-700 border-red-300 hover:bg-red-100"
          >
            נסה שוב
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Wraps a page section with error boundary protection
 *
 * @example
 * <SectionErrorBoundary sectionName="Order Details">
 *   <OrderDetailsSection order={order} />
 * </SectionErrorBoundary>
 */
export function SectionErrorBoundary({
  sectionName,
  children,
  onError,
}: SectionErrorBoundaryProps) {
  const handleError = (error: unknown, errorInfo: { componentStack?: string | null | undefined }) => {
    console.error(`[SectionErrorBoundary] Error in ${sectionName}:`, {
      error,
      componentStack: errorInfo.componentStack,
    });
    onError?.(error instanceof Error ? error : new Error(String(error)), { componentStack: errorInfo.componentStack || '' });
  };

  return (
    <ErrorBoundary
      FallbackComponent={(props) => <SectionErrorFallback {...props} sectionName={sectionName} />}
      onError={handleError}
      onReset={() => {
        // Optional: Add any cleanup logic here
        console.log(`[SectionErrorBoundary] Resetting ${sectionName}`);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
