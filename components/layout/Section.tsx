/**
 * Section Component
 *
 * A unified content section component with consistent spacing,
 * backgrounds, and styling across the application.
 *
 * Features:
 * - Consistent padding and margins
 * - Optional title and description
 * - Multiple variants (default, card, bordered, etc.)
 * - RTL support
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Section content */
  children: React.ReactNode;

  /** Section title */
  title?: string;

  /** Section description */
  description?: string;

  /** Section variant */
  variant?: 'default' | 'card' | 'bordered' | 'elevated' | 'brutal';

  /** Spacing size */
  spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl';

  /** Additional CSS classes */
  className?: string;

  /** HTML element type */
  as?: 'div' | 'section' | 'article' | 'aside';

  /** Header actions (e.g., buttons, links) */
  headerActions?: React.ReactNode;

  /** Show loading state */
  loading?: boolean;
}

/**
 * Spacing size mappings
 */
const spacingSizes = {
  none: '',
  sm: 'p-3',   // 12px
  md: 'p-4',   // 16px
  lg: 'p-6',   // 24px
  xl: 'p-8',   // 32px
} as const;

/**
 * Variant styles
 */
const variantStyles = {
  default: '',
  card: 'app-card-premium overflow-hidden',
  bordered: 'overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-muted)]',
  elevated: 'app-card-premium overflow-hidden shadow-[var(--shadow-md)]',
  brutal: 'app-card-premium overflow-hidden shadow-[var(--shadow-md)]',
} as const;

/**
 * Section - Unified content section component
 *
 * @example
 * ```tsx
 * <Section title="הזמנות אחרונות" description="רשימת ההזמנות האחרונות במערכת">
 *   <OrdersList />
 * </Section>
 *
 * <Section variant="card" spacing="lg">
 *   <Form />
 * </Section>
 * ```
 */
export const Section: React.FC<SectionProps> = ({
  children,
  title,
  description,
  variant = 'default',
  spacing = 'md',
  className,
  as: Component = 'section',
  headerActions,
  loading = false,
  ...htmlProps
}) => {
  const hasHeader = title || description || headerActions;

  return (
    <Component
      {...htmlProps}
      className={cn(
        variantStyles[variant],
        spacingSizes[spacing],
        className
      )}
      dir="rtl"
    >
      {hasHeader && (
        <div className={cn('mb-4', spacing === 'xl' && 'mb-6')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              {title && (
                <h2 className="text-fluid-section-title font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  {description}
                </p>
              )}
            </div>
            {headerActions && <div className="flex-shrink-0">{headerActions}</div>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary-200)] border-t-[var(--color-primary-600)]" />
        </div>
      ) : (
        children
      )}
    </Component>
  );
};

/**
 * SectionHeader - Standalone section header
 *
 * Useful when you need just the header without the section wrapper
 */
export interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  actions,
  className,
}) => {
  return (
    <div className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)} dir="rtl">
      <div className="flex-1">
        <h2 className="text-fluid-section-title font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
};

/**
 * SectionDivider - Visual divider between sections
 */
export const SectionDivider: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <hr className={cn('my-6 border-t border-[var(--border-default)]', className)} />
  );
};

export default Section;
