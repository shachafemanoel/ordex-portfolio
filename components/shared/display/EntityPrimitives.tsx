'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type EntityTone = 'info' | 'success' | 'warning' | 'accent' | 'neutral';
export type EntityBadgeSize = 'sm' | 'md' | 'lg';

const BADGE_TONE_CLASSES: Record<EntityTone, string> = {
  info: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-strong)]',
  success: 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-strong)]',
  warning: 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-strong)]',
  accent: 'border-[var(--tone-accent-border)] bg-[var(--tone-accent-bg)] text-[var(--tone-accent-strong)]',
  neutral: 'border-[var(--border-default)] bg-[var(--surface-muted)] text-[var(--text-secondary)]',
};

export function getEntityBadgeClassName(
  tone: EntityTone = 'neutral',
  size: EntityBadgeSize = 'sm'
) {
  return cn(
    'inline-flex min-h-[1.5rem] items-center justify-center gap-1.5 rounded-full border text-center font-semibold leading-none shadow-none transition-[background-color,border-color,color]',
    size === 'sm' && 'px-2.5 py-1 text-[11px] leading-tight',
    size === 'md' && 'px-3 py-1.5 text-xs',
    size === 'lg' && 'px-4 py-2 text-sm',
    BADGE_TONE_CLASSES[tone]
  );
}

export function EntitySurface({
  className,
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-xl)] border border-[color:var(--color-border-primary)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm',
        className
      )}
    >
      {children}
    </section>
  );
}

/**
 * Compact semantic badge.
 * Use `tone=info` for neutral process info, `success` for completed/healthy,
 * `warning` for attention-needed states, and `accent` for highlighted secondary context.
 */
export function EntityBadge({
  label,
  tone = 'neutral',
  size = 'sm',
  dotClassName,
  className,
  children,
}: Readonly<{
  label: string;
  tone?: EntityTone;
  size?: EntityBadgeSize;
  dotClassName?: string;
  className?: string;
  children?: ReactNode;
}>) {
  return (
    <span className={cn(getEntityBadgeClassName(tone, size), className)}>
      {children}
      {dotClassName ? <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClassName)} /> : null}
      <span className="min-w-0 text-center leading-tight">{label}</span>
    </span>
  );
}

export function EntityField({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
  className,
}: Readonly<{
  icon?: LucideIcon;
  label: string;
  value: string;
  tone?: 'info' | 'warning' | 'neutral';
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-[var(--radius-lg)] border border-[color:var(--color-border-primary)] px-3.5 py-2.5 shadow-none',
        tone === 'info' && 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)]',
        tone === 'warning' && 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)]',
        tone === 'neutral' && 'bg-[var(--surface-card)]',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase',
          tone === 'info' && 'text-[var(--tone-info-strong)]',
          tone === 'warning' && 'text-[var(--tone-warning-strong)]',
          tone === 'neutral' && 'text-[var(--text-tertiary)]'
        )}
      >
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={3} /> : null}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

export function EntityActionButton({
  children,
  tone = 'primary',
  className,
  ...props
}: Readonly<ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary';
}>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-5 text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98]',
        tone === 'primary' &&
          'border-[var(--color-primary-600)] bg-[var(--color-primary-600)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-700)]',
        tone === 'secondary' &&
          'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]',
        className
      )}
    >
      {children}
    </button>
  );
}

export function EntityActionLink({
  children,
  tone = 'secondary',
  className,
  ...props
}: Readonly<AnchorHTMLAttributes<HTMLAnchorElement> & {
  tone?: 'primary' | 'secondary';
}>) {
  return (
    <a
      {...props}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-5 text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98]',
        tone === 'primary' &&
          'border-[var(--color-primary-600)] bg-[var(--color-primary-600)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-700)]',
        tone === 'secondary' &&
          'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]',
        className
      )}
    >
      {children}
    </a>
  );
}

export function EntityNotice({
  icon: Icon,
  title,
  description,
  tone = 'neutral',
  className,
  children,
}: Readonly<{
  icon?: LucideIcon;
  title: string;
  description?: string;
  tone?: EntityTone;
  className?: string;
  children?: ReactNode;
}>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-xl)] border px-4 py-3.5 shadow-[var(--shadow-sm)]',
        tone === 'info' && 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-strong)]',
        tone === 'success' &&
          'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-strong)]',
        tone === 'warning' &&
          'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-strong)]',
        tone === 'accent' && 'border-[var(--tone-accent-border)] bg-[var(--tone-accent-bg)] text-[var(--tone-accent-strong)]',
        tone === 'neutral' && 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <div
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
              tone === 'info' && 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-strong)]',
              tone === 'success' &&
                'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-strong)]',
              tone === 'warning' &&
                'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-strong)]',
              tone === 'accent' &&
                'border-[var(--tone-accent-border)] bg-[var(--tone-accent-bg)] text-[var(--tone-accent-strong)]',
              tone === 'neutral' && 'border-[var(--border-default)] bg-[var(--surface-muted)] text-[var(--text-secondary)]'
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.5} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
          {description ? (
            <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {description}
            </div>
          ) : null}
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
