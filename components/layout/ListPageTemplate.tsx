/**
 * ListPageTemplate Component
 *
 * A unified template for list pages (Orders, Customers, Suppliers, etc.)
 * Provides consistent structure: Header → Filters → Stats → Content → Pagination
 */

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageScaffold, PageScaffoldPanel } from '@/components/layout/shell/PageScaffold';

export interface ListPageTemplateProps {
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    disabled?: boolean;
  };
  headerActions?: ReactNode;
  filters?: ReactNode;
  stats?: ReactNode;
  children: ReactNode;
  pagination?: ReactNode;
  viewMode?: {
    current: 'table' | 'cards';
    onChange: (mode: 'table' | 'cards') => void;
  };
  loading?: boolean;
  emptyState?: {
    title: string;
    description?: string;
    action?: ReactNode;
  };
  isEmpty?: boolean;
  className?: string;
}

export const ListPageTemplate: React.FC<ListPageTemplateProps> = ({
  title,
  description,
  primaryAction,
  headerActions,
  filters,
  stats,
  children,
  pagination,
  viewMode,
  loading = false,
  emptyState,
  isEmpty = false,
  className,
}) => {
  return (
    <PageScaffold className={cn(className)} dir="rtl">
      <PageHeader title={title} description={description}>
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          {viewMode && (
            <div className="inline-flex rounded-full border border-subtle bg-surface-muted p-1 shadow-sm">
              <button
                onClick={() => viewMode.onChange('table')}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                  viewMode.current === 'table'
                    ? 'bg-surface text-brand shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                )}
                aria-label="תצוגת טבלה"
              >
                TABLE
              </button>
              <button
                onClick={() => viewMode.onChange('cards')}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                  viewMode.current === 'cards'
                    ? 'bg-surface text-brand shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                )}
                aria-label="תצוגת כרטיסיות"
              >
                CARDS
              </button>
            </div>
          )}

          {headerActions}

          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="flex items-center gap-2 px-6"
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Filters */}
      {filters && (
        <PageScaffoldPanel className="p-5">
          {filters}
        </PageScaffoldPanel>
      )}

      {/* Stats */}
      {stats && <div>{stats}</div>}

      {/* Main Content */}
      <div className={cn(loading && 'pointer-events-none opacity-60')}>
        {isEmpty && emptyState ? (
          <PageScaffoldPanel className="border-dashed p-8">
            <div className="text-center max-w-md mx-auto">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-fg mb-3">{emptyState.title}</h3>
              {emptyState.description && (
                <p className="text-fg-muted mb-6">{emptyState.description}</p>
              )}
              {emptyState.action && <div>{emptyState.action}</div>}
            </div>
          </PageScaffoldPanel>
        ) : (
          <PageScaffoldPanel className="overflow-hidden">
            {children}
          </PageScaffoldPanel>
        )}
      </div>

      {/* Pagination */}
      {pagination && !isEmpty && (
        <div className="flex justify-center pt-2">{pagination}</div>
      )}
    </PageScaffold>
  );
};

export default ListPageTemplate;
