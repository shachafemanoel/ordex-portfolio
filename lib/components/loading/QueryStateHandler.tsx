/**
 * Query State Handler - טיפול אחיד במצבי React Query
 *
 * מטפל בכל מצבי ה-query באופן אוטומטי:
 * - Loading: מציג skeleton
 * - Error: מציג הודעת שגיאה
 * - Empty: מציג empty state
 * - Success: מציג את הנתונים
 *
 * שימוש:
 * <QueryStateHandler
 *   query={useOrdersQuery()}
 *   skeleton={<OrdersSkeleton />}
 *   emptyCheck={(data) => data.items.length === 0}
 * >
 *   {(data) => <OrdersTable data={data} />}
 * </QueryStateHandler>
 */

'use client';

import { Button } from '@/components/ui/Button';
import { SkeletonTable } from '@/components/ui/Loading';
import { Card, CardContent } from '@/components/ui/card';
import type { UseQueryResult } from '@tanstack/react-query';
import { type ReactNode } from 'react';

interface QueryStateHandlerProps<T> {
  /** React Query result object */
  query: UseQueryResult<T>;
  /** Custom skeleton component for loading state */
  skeleton?: ReactNode;
  /** Custom empty state component */
  emptyState?: ReactNode;
  /** Custom error fallback component */
  errorFallback?: ReactNode;
  /** Function to render success state with data */
  children: (data: T) => ReactNode;
  /** Function to check if data is empty (optional) */
  emptyCheck?: (data: T) => boolean;
  /** Show retry button on error (default: true) */
  showRetry?: boolean;
}

export function QueryStateHandler<T>({
  query,
  skeleton,
  emptyState,
  errorFallback,
  children,
  emptyCheck,
  showRetry = true,
}: QueryStateHandlerProps<T>) {
  // Loading state
  if (query.isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" aria-label="טוען נתונים">
        {skeleton || (
          <Card>
            <CardContent className="p-4">
              <SkeletonTable rows={5} columns={6} />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Error state
  if (query.error) {
    const errorMessage =
      query.error instanceof Error ? query.error.message : 'אירעה שגיאה בטעינת הנתונים';

    return (
      <div role="alert" aria-live="assertive">
        {errorFallback || (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4" dir="rtl">
                {/* Error Icon */}
                <div className="flex-shrink-0 rounded-full bg-red-100 p-3">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">שגיאה בטעינת הנתונים</h3>
                  <p className="text-sm text-red-700 mb-4">{errorMessage}</p>

                  {showRetry && (
                    <Button
                      variant="outline"
                      onClick={() => query.refetch()}
                      disabled={query.isRefetching}
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      {query.isRefetching ? 'מנסה שוב...' : 'נסה שוב'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Check for empty data
  const isEmpty = emptyCheck ? emptyCheck(query.data!) : !query.data;

  if (isEmpty) {
    return (
      <div role="status" aria-live="polite">
        {emptyState || (
          <Card>
            <CardContent className="py-12 text-center">
              {/* Empty State Icon */}
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg
                  className="h-8 w-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <p className="text-lg text-gray-500">אין נתונים להצגה</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Success state - render children with data
  return <>{children(query.data!)}</>;
}

/**
 * Specialized variant for list data
 * Automatically handles array empty checks
 */
export function QueryListHandler<TItem>({
  query,
  skeleton,
  emptyState,
  errorFallback,
  children,
  showRetry = true,
}: Omit<QueryStateHandlerProps<TItem[]>, 'emptyCheck' | 'children'> & {
  children: (data: TItem[]) => ReactNode;
}) {
  return (
    <QueryStateHandler
      query={query}
      skeleton={skeleton}
      emptyState={emptyState}
      errorFallback={errorFallback}
      emptyCheck={(data) => data.length === 0}
      showRetry={showRetry}
    >
      {children}
    </QueryStateHandler>
  );
}

/**
 * Specialized variant for paginated data
 * Handles pagination metadata
 */
interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  [key: string]: any;
}

export function QueryPaginatedHandler<TItem>({
  query,
  skeleton,
  emptyState,
  errorFallback,
  children,
  showRetry = true,
}: Omit<QueryStateHandlerProps<PaginatedData<TItem>>, 'emptyCheck' | 'children'> & {
  children: (data: PaginatedData<TItem>) => ReactNode;
}) {
  return (
    <QueryStateHandler
      query={query}
      skeleton={skeleton}
      emptyState={emptyState}
      errorFallback={errorFallback}
      emptyCheck={(data) => data.items.length === 0}
      showRetry={showRetry}
    >
      {children}
    </QueryStateHandler>
  );
}
