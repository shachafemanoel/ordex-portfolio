/**
 * Layout Components - Centralized Export
 *
 * Single source of truth for all layout components.
 * Import from here instead of individual files.
 *
 * @example
 * ```tsx
 * import { ListPageTemplate, Section, ResponsiveGrid } from '@/components/layout';
 * ```
 */

// Page Templates
export { ListPageTemplate } from '@/components/layout/ListPageTemplate';
export type { ListPageTemplateProps } from '@/components/layout/ListPageTemplate';

export { DetailsPageTemplate } from '@/components/layout/DetailsPageTemplate';
export type { DetailsPageTemplateProps } from '@/components/layout/DetailsPageTemplate';

// Layout Building Blocks
export { GridLayouts, GridWithLayout, ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
export type { GridWithLayoutProps, ResponsiveGridProps } from '@/components/layout/ResponsiveGrid';

export { Section, SectionDivider, SectionHeader } from '@/components/layout/Section';
export type { SectionHeaderProps, SectionProps } from '@/components/layout/Section';

// Existing Layout Components
export { AppShell } from '@/components/layout/AppShell';
export { Breadcrumbs } from '@/components/layout/Breadcrumbs';
export { PageHeader } from '@/components/layout/PageHeader';

// Mobile UI Components
export { BottomNav } from '@/components/layout/BottomNav';
export type { BottomNavProps } from '@/components/layout/BottomNav';

// Migrated Templates
export { DashboardPage } from '@/components/layout/templates/DashboardPage';
