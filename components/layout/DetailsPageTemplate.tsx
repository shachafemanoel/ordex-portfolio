/**
 * DetailsPageTemplate Component
 *
 * A unified template for detail pages (Order Details, Customer Details, etc.)
 * Provides consistent structure: Breadcrumbs → Header → Tabs → Content Grid
 *
 * Features:
 * - Consistent detail page structure
 * - Responsive two-column layout (main + sidebar)
 * - Optional tabs navigation
 * - Breadcrumbs support
 * - RTL support
 */

import { Button } from '@/components/ui/Button';
import { Section } from '@/components/layout/Section';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import React, { ReactNode } from 'react';

export interface DetailsPageTemplateProps {
  /** Page title */
  title: string;

  /** Page subtitle (e.g., order number) */
  subtitle?: string;

  /** Page description */
  description?: string;

  /** Breadcrumbs */
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;

  /** Status badge or indicator */
  status?: ReactNode;

  /** Header actions (e.g., edit, delete buttons) */
  headerActions?: ReactNode;

  /** Tabs navigation */
  tabs?: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
    count?: number;
  }>;

  /** Active tab ID */
  activeTab?: string;

  /** Tab change handler */
  onTabChange?: (tabId: string) => void;

  /** Main content */
  children: ReactNode;

  /** Sidebar content (optional) */
  sidebar?: ReactNode;

  /** Show sidebar on mobile as well */
  sidebarAlwaysVisible?: boolean;

  /** Loading state */
  loading?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Back button */
  backButton?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Breadcrumbs Component
 */
const Breadcrumbs: React.FC<{
  items: Array<{ label: string; href?: string }>;
}> = ({ items }) => {
  return (
    <nav className="mb-2 flex" aria-label="Breadcrumb" dir="rtl">
      <ol className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 && <span className="text-[var(--text-tertiary)]">/</span>}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-[var(--text-primary)]">
                {item.label}
              </Link>
            ) : (
              <span className="text-[var(--text-primary)]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

/**
 * Tabs Navigation Component
 */
const TabsNav: React.FC<{
  tabs: Array<{ id: string; label: string; icon?: ReactNode; count?: number }>;
  activeTab: string;
  onChange: (tabId: string) => void;
}> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className="overflow-x-auto pb-1" dir="rtl">
      <nav className="flex min-w-max gap-2" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'group inline-flex items-center rounded-full border px-3.5 py-2 text-xs font-medium transition-colors sm:px-4',
              activeTab === tab.id
                ? 'border-[var(--tone-accent-border)] bg-[var(--tone-accent-bg)] text-[var(--tone-accent-strong)] shadow-[var(--shadow-sm)]'
                : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.icon && (
              <span className={cn('me-2', activeTab === tab.id ? '' : 'text-[var(--text-tertiary)]')}>
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'ms-2 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
                  activeTab === tab.id
                    ? 'bg-[var(--surface-card)] text-[var(--text-primary)]'
                    : 'bg-[var(--surface-muted)] text-[var(--text-secondary)]'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};

/**
 * DetailsPageTemplate - Unified template for detail pages
 *
 * @example
 * ```tsx
 * <DetailsPageTemplate
 *   title="הזמנה 12345"
 *   subtitle="לקוח: יוסי כהן"
 *   status={<StatusBadge status="TO_DO" />}
 *   breadcrumbs={[
 *     { label: "הזמנות", href: "/orders" },
 *     { label: "12345" }
 *   ]}
 *   tabs={[
 *     { id: "details", label: "פרטים" },
 *     { id: "history", label: "היסטוריה" }
 *   ]}
 *   activeTab="details"
 *   sidebar={<OrderSidebar />}
 * >
 *   <OrderDetails />
 * </DetailsPageTemplate>
 * ```
 */
export const DetailsPageTemplate: React.FC<DetailsPageTemplateProps> = ({
  title,
  subtitle,
  description,
  breadcrumbs,
  status,
  headerActions,
  tabs,
  activeTab,
  onTabChange,
  children,
  sidebar,
  sidebarAlwaysVisible = false,
  loading = false,
  className,
  backButton,
}) => {
  return (
    <div className={cn('space-y-[var(--app-shell-gap)]', className)} dir="rtl">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}

      {backButton && (
        <div className="mb-1 lg:hidden">
          <Button
            variant="ghost"
            onClick={backButton.onClick}
            className="h-9 gap-2 rounded-full px-3"
          >
            <svg
              className="w-4 h-4 rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {backButton.label}
          </Button>
        </div>
      )}

      <Section variant="elevated" spacing="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h1 className="text-fluid-page-title truncate font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                {title}
              </h1>
              {status && <div className="flex-shrink-0">{status}</div>}
            </div>
            {subtitle && (
              <p className="text-sm font-medium text-[var(--text-secondary)]">{subtitle}</p>
            )}
            {description && (
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
            )}
          </div>
          {headerActions && <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div>}
        </div>
      </Section>

      {tabs && activeTab && onTabChange && (
        <TabsNav tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary-200)] border-t-[var(--color-primary-600)]" />
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-4',
            sidebar && 'xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.88fr)]',
            !sidebar && 'grid-cols-1'
          )}
        >
          <div>{children}</div>

          {sidebar && (
            <div className={cn('space-y-4', !sidebarAlwaysVisible && 'hidden xl:block')}>
              {sidebar}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DetailsPageTemplate;
