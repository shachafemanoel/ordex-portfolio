'use client';

/**
 * ModuleLayout
 * Standard layout for module pages (Orders, Customers, etc.)
 * Enforces: Header -> KPIs -> Action Feed -> Main Content
 *
 * v2: Urgency-aware action feed, better mobile spacing, percentage-based layout.
 */

import { PageHeader } from '@/components/layout/PageHeader';
import { Section } from '@/components/layout/Section';
import { AlertTriangle } from 'lucide-react';

interface ModuleLayoutProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  kpis?: React.ReactNode;
  feed?: React.ReactNode;
  feedTitle?: string;
  feedCount?: number;
  children: React.ReactNode;
}

export function ModuleLayout({
  title,
  description,
  actions,
  kpis,
  feed,
  feedTitle = 'דורש טיפול',
  feedCount,
  children,
}: ModuleLayoutProps) {
  return (
    <div className="w-full space-y-[var(--app-shell-gap)] animate-fade-in-up">
      {/* 1. Header */}
      <PageHeader title={title} description={description} actions={actions} />

      {/* 2. KPIs */}
      {kpis && <div className="w-full">{kpis}</div>}

      {/* 3. Action Feed — only shown when there are items requiring attention */}
      {feed && (
        <Section variant="card" spacing="none" className="w-full overflow-hidden" role="region" aria-label={feedTitle}>
          {/* Feed header with urgency indicator */}
          <div className="flex items-center gap-2.5 border-b border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] px-[clamp(12px,2.5vw,20px)] py-[clamp(8px,1.5vw,12px)]">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--tone-warning-border)] bg-[var(--surface-card)] text-[var(--tone-warning-strong)]">
              <AlertTriangle className="h-4 w-4" />
              {/* Pulsing dot indicator */}
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-dot-ping rounded-full bg-[var(--tone-warning-strong)] ring-2 ring-[var(--surface-card)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[clamp(12px,2.5vw,14px)] font-semibold text-[var(--text-primary)]">
                {feedTitle}
              </h2>
            </div>
            {feedCount !== undefined && feedCount > 0 && (
              <span className="urgency-indicator high shrink-0">{feedCount}</span>
            )}
          </div>
          {/* Feed content */}
          <div className="p-[clamp(10px,2vw,16px)]">{feed}</div>
        </Section>
      )}

      {/* 4. Main Table / Content */}
      <div className="relative w-full">{children}</div>
    </div>
  );
}
