'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/**
 * Semantic display templates — use instead of ad-hoc font-size + color classes.
 * Pair with design tokens (text-fg, tone-*, EntityBadge).
 */

export function DisplayName({
  children,
  className,
  as: Tag = 'span',
}: {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'p' | 'div';
}) {
  return (
    <Tag className={cn('font-semibold text-fg tracking-tight', className)}>{children}</Tag>
  );
}

export function DisplayDateTime({
  children,
  className,
  as: Tag = 'span',
}: {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'time' | 'p';
}) {
  return (
    <Tag className={cn('text-sm font-medium text-fg-muted tabular-nums', className)}>
      {children}
    </Tag>
  );
}

export function DisplayItemLine({
  primary,
  secondary,
  className,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 text-right', className)}>
      <div className="truncate text-sm font-medium text-fg">{primary}</div>
      {secondary != null && secondary !== '' ? (
        <div className="mt-0.5 truncate text-xs text-fg-muted">{secondary}</div>
      ) : null}
    </div>
  );
}

export type DisplaySemanticTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

const SEMANTIC_BADGE: Record<
  DisplaySemanticTone,
  { className: string }
> = {
  neutral: {
    className: 'border border-subtle bg-surface-muted text-fg-muted',
  },
  info: {
    className: 'tone-info px-2 py-0.5',
  },
  success: {
    className: 'tone-success px-2 py-0.5',
  },
  warning: {
    className: 'tone-warning px-2 py-0.5',
  },
  danger: {
    className: 'surface-danger-soft px-2 py-0.5',
  },
  accent: {
    className: 'tone-accent px-2 py-0.5',
  },
};

export function DisplaySemanticBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: DisplaySemanticTone;
  className?: string;
}) {
  const cfg = SEMANTIC_BADGE[tone];
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-h-[1.5rem] items-center justify-center rounded-full px-2.5 text-[11px] font-bold leading-tight text-center',
        cfg.className,
        className
      )}
    >
      {children}
    </span>
  );
}

export function DisplayCaption({
  children,
  className,
  as: Tag = 'span',
}: {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'p';
}) {
  return (
    <Tag className={cn('text-xs font-medium text-fg-subtle', className)}>{children}</Tag>
  );
}
