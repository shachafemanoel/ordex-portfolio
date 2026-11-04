'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

export interface OpsCompactHeaderProps {
  title: string;
  subtitle: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function OpsCompactHeader({
  title,
  subtitle,
  actions,
  children,
  className,
}: Readonly<OpsCompactHeaderProps>) {
  return (
    <section
      className={cn(
        'border-b border-[color:var(--color-border-primary)] bg-surface/85 px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-4',
        'sticky top-0 z-20',
        'shadow-sm',
        className
      )}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-fluid-page-title truncate font-black tracking-[-0.04em] text-fg">
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-fluid-caption font-semibold text-fg-muted">
              {subtitle}
            </div>
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export interface OpsCompactTabProps {
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  activeClassName: string;
  countClassName: string;
  onClick: () => void;
}

export function OpsCompactTab({
  icon: Icon,
  label,
  count,
  active,
  activeClassName,
  countClassName,
  onClick,
}: Readonly<OpsCompactTabProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--color-border-primary)] px-3 py-1.5 text-xs font-black whitespace-nowrap transition-all duration-200 active:scale-95',
        active
          ? cn(activeClassName, 'shadow-sm')
          : 'bg-surface-muted/80 text-fg-muted hover:bg-surface-muted backdrop-blur-sm'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
      <span
        className={cn(
          'rounded-full bg-surface px-1.5 py-0.5 text-[10px] tabular-nums ring-1 ring-[color:var(--color-border-primary)]',
          active ? countClassName : 'text-fg-subtle'
        )}
      >
        {count}
      </span>
    </button>
  );
}

export interface OpsDisclosurePanelProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  buttonLabel?: string;
}

export function OpsDisclosurePanel({
  title,
  open,
  onToggle,
  children,
  className,
  buttonLabel = 'מידע נוסף',
}: Readonly<OpsDisclosurePanelProps>) {
  return (
    <section
      className={cn(
        'app-shell-surface border border-white/60 bg-white/70 p-3 shadow-[0_4px_24px_-8px_rgba(0,85,255,0.06)] backdrop-blur-2xl backdrop-saturate-[1.8] sm:p-4',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-fluid-section-title font-black text-[#0f172a]">{title}</div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/50 px-3 text-xs font-bold text-[#34517a] transition-all active:scale-95 hover:bg-white/80 sm:px-4"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} />
          {buttonLabel}
        </button>
      </div>
      {open ? (
        <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-150">{children}</div>
      ) : null}
    </section>
  );
}

export interface OpsBoardSurfaceProps {
  title: string;
  countLabel?: string;
  children: ReactNode;
  className?: string;
}

export function OpsBoardSurface({
  title,
  countLabel,
  children,
  className,
}: Readonly<OpsBoardSurfaceProps>) {
  return (
    <section
      className={cn(
        'app-shell-surface border border-white/60 bg-white/70 shadow-[0_4px_24px_-8px_rgba(0,85,255,0.06)] backdrop-blur-2xl backdrop-saturate-[1.8]',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-white/50 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="text-fluid-section-title font-black text-[#0f172a]">{title}</div>
        {countLabel ? (
          <div className="rounded-full bg-white/50 px-2.5 py-1 text-xs font-bold text-[#58708f]">
            {countLabel}
          </div>
        ) : null}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}
