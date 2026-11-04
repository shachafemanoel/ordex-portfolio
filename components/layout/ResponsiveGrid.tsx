/**
 * ResponsiveGrid Component
 *
 * A unified responsive grid system that provides consistent
 * breakpoints and column layouts across all pages.
 *
 * Features:
 * - Mobile-first responsive design
 * - Consistent breakpoints (mobile/tablet/desktop/wide)
 * - Flexible column configuration
 * - RTL support
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface ResponsiveGridProps {
  /** Grid content */
  children: React.ReactNode;

  /** Number of columns for each breakpoint */
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
    wide?: number;
  };

  /** Gap between grid items */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /** Additional CSS classes */
  className?: string;

  /** HTML element type */
  as?: 'div' | 'section' | 'article' | 'main' | 'aside';
}

/**
 * Gap size mappings
 */
const gapSizes = {
  xs: 'gap-2',  // 8px
  sm: 'gap-3',  // 12px
  md: 'gap-4',  // 16px
  lg: 'gap-6',  // 24px
  xl: 'gap-8',  // 32px
} as const;

/**
 * ResponsiveGrid - Unified grid layout component
 *
 * @example
 * ```tsx
 * // Default: 1 col mobile, 2 tablet, 3 desktop, 4 wide
 * <ResponsiveGrid>
 *   <Card />
 *   <Card />
 *   <Card />
 * </ResponsiveGrid>
 *
 * // Custom columns
 * <ResponsiveGrid cols={{ mobile: 1, tablet: 2, desktop: 4, wide: 4 }} gap="lg">
 *   <MetricCard />
 *   <MetricCard />
 * </ResponsiveGrid>
 * ```
 */
export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  cols = {
    mobile: 1,
    tablet: 2,
    desktop: 3,
    wide: 4,
  },
  gap = 'md',
  className,
  as: Component = 'div',
}) => {
  // Build grid columns classes
  const gridColsClasses = [
    // Mobile (default)
    `grid-cols-${cols.mobile || 1}`,
    // Tablet (md breakpoint)
    cols.tablet && `md:grid-cols-${cols.tablet}`,
    // Desktop (lg breakpoint)
    cols.desktop && `lg:grid-cols-${cols.desktop}`,
    // Wide (xl breakpoint)
    cols.wide && `xl:grid-cols-${cols.wide}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component
      className={cn('grid', gridColsClasses, gapSizes[gap], className)}
      dir="rtl"
    >
      {children}
    </Component>
  );
};

/**
 * Predefined grid layouts for common use cases
 */
export const GridLayouts = {
  /** Dashboard metrics: 1/2/2/4 columns */
  metrics: { mobile: 1, tablet: 2, desktop: 2, wide: 4 },

  /** Order list cards: 1/2/3/3 columns */
  cards: { mobile: 1, tablet: 2, desktop: 3, wide: 3 },

  /** Two-column layout: 1/2/2/2 columns */
  twoColumn: { mobile: 1, tablet: 2, desktop: 2, wide: 2 },

  /** Form sections: 1/1/2/2 columns */
  formSections: { mobile: 1, tablet: 1, desktop: 2, wide: 2 },

  /** Wide grid: 1/3/4/6 columns */
  wide: { mobile: 1, tablet: 3, desktop: 4, wide: 6 },
} as const;

/**
 * Responsive Grid with predefined layout
 *
 * @example
 * ```tsx
 * <GridWithLayout layout="metrics" gap="lg">
 *   <MetricCard />
 *   <MetricCard />
 * </GridWithLayout>
 * ```
 */
export interface GridWithLayoutProps extends Omit<ResponsiveGridProps, 'cols'> {
  layout: keyof typeof GridLayouts;
}

export const GridWithLayout: React.FC<GridWithLayoutProps> = ({
  layout,
  ...props
}) => {
  return <ResponsiveGrid cols={GridLayouts[layout]} {...props} />;
};

export default ResponsiveGrid;
