'use client';

import { cn } from '@/lib/utils';
import type { HTMLAttributes, ReactNode } from 'react';

export interface PageScaffoldProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  surface?: boolean;
}

export function PageScaffold({
  children,
  className,
  surface = false,
  ...props
}: Readonly<PageScaffoldProps>) {
  return (
    <section
      {...props}
      className={cn(
        'space-y-[var(--app-shell-gap)]',
        surface && 'app-shell-surface border border-subtle bg-surface p-3 shadow-sm sm:p-4 lg:p-5',
        className
      )}
    >
      {children}
    </section>
  );
}

export interface PageScaffoldHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  tabs?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
  withDivider?: boolean;
}

export function PageScaffoldHeader({
  title,
  description,
  actions,
  meta,
  tabs,
  breadcrumbs,
  className,
  withDivider = true,
}: Readonly<PageScaffoldHeaderProps>) {
  return (
    <header
      className={cn(
        'space-y-4',
        withDivider && 'border-b border-subtle pb-4',
        className
      )}
    >
      {breadcrumbs ? (
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-[0.08em] text-fg-subtle">
          {breadcrumbs}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="text-fluid-page-title font-bold tracking-[-0.03em] text-fg">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-7 text-fg-muted sm:text-base">
              {description}
            </p>
          ) : null}
          {meta ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              {meta}
            </div>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
      </div>

      {tabs ? <div className="flex flex-wrap items-center gap-2">{tabs}</div> : null}
    </header>
  );
}

export interface PageScaffoldPanelProps {
  children: ReactNode;
  className?: string;
}

export function PageScaffoldPanel({ children, className }: Readonly<PageScaffoldPanelProps>) {
  return (
    <section
      className={cn(
        'app-shell-surface overflow-hidden border border-subtle bg-surface shadow-sm',
        className
      )}
    >
      {children}
    </section>
  );
}
