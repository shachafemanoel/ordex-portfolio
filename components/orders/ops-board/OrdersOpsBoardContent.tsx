'use client';

import { QueueSection } from '@/src/ui/patterns/QueueSection';
import type { OpsQueue } from '@/src/server/dto/ops.dto';
import { Loader2, Search, X } from 'lucide-react';

interface OrdersOpsBoardContentProps {
  error: unknown;
  isLoading: boolean;
  queues: OpsQueue[];
  searchQuery: string;
  onRetry: () => void;
  onClearSearch: () => void;
  onItemClick: (id: string) => void;
  onRefresh: () => void;
  emptyStateLabel: string;
  clearSearchLabel: string;
}

export function OrdersOpsBoardContent({
  error,
  isLoading,
  queues,
  searchQuery,
  onRetry,
  onClearSearch,
  onItemClick,
  onRefresh,
  emptyStateLabel,
  clearSearchLabel,
}: Readonly<OrdersOpsBoardContentProps>) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-surface-soft bg-surface-translucent px-4 py-8 text-center backdrop-blur-md">
        <p className="text-sm font-semibold text-accent">
          {error instanceof Error ? error.message : 'שגיאה בטעינת ההזמנות'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full border border-surface-soft bg-surface-translucent px-5 py-2 text-sm font-bold text-brand backdrop-blur-md transition-all active:scale-95 hover:bg-surface-translucent-strong"
        >
          נסה שוב
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (queues.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-5 text-center text-ops-muted">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-translucent backdrop-blur-md">
          <Search className="h-9 w-9 text-ops-icon-muted" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-brand-deep">{emptyStateLabel}</p>
          <p className="text-sm text-ops-icon-muted">אין הזמנות להצגה</p>
        </div>
        {searchQuery ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="inline-flex items-center gap-2 rounded-full border border-surface-soft bg-surface-translucent px-5 py-2.5 text-sm font-bold text-brand backdrop-blur-md transition-all active:scale-95 hover:bg-surface-translucent-strong"
          >
            <X className="h-4 w-4" />
            {clearSearchLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {queues.map((queue) => (
        <QueueSection
          key={queue.key}
          title={queue.title}
          count={queue.count}
          top={queue.top}
          rest={queue.rest}
          onItemClick={onItemClick}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
