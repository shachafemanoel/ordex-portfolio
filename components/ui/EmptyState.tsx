/**
 * EmptyState — canonical empty / zero-data UI (design tokens, light-only).
 * Prefer `lucideIcon` for icons; `icon` remains for emoji / custom nodes.
 */

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import React, { type ReactNode } from 'react';

export interface EmptyStateProps {
  /** Emoji string or custom node (e.g. illustration) */
  icon?: ReactNode;
  /** Lucide icon in a token-styled circle (preferred for new code) */
  lucideIcon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    /** `default` maps to primary CTA (shadcn-style naming) */
    variant?: 'primary' | 'secondary' | 'outline' | 'default' | 'ghost';
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Extra actions or content below buttons */
  children?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

function mapActionVariant(
  v?: 'primary' | 'secondary' | 'outline' | 'default' | 'ghost'
): 'primary' | 'secondary' | 'outline' | 'ghost' {
  if (v === 'default' || v === 'primary' || !v) return 'primary';
  if (v === 'ghost') return 'ghost';
  if (v === 'outline') return 'outline';
  return 'secondary';
}

export function EmptyState({
  icon,
  lucideIcon: Lucide,
  title,
  description,
  action,
  secondaryAction,
  children,
  className = '',
  size = 'md',
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: 'py-8',
      lucideWrap: 'mb-3 rounded-full bg-surface-muted p-4',
      lucideIcon: 'h-8 w-8 text-fg-subtle',
      emoji: 'text-4xl mb-3',
      title: 'text-base font-semibold',
      description: 'text-sm',
      spacing: 'space-y-2',
    },
    md: {
      container: 'py-12',
      lucideWrap: 'mb-4 rounded-full bg-surface-muted p-6',
      lucideIcon: 'h-10 w-10 text-fg-subtle',
      emoji: 'text-6xl mb-4',
      title: 'text-lg font-semibold',
      description: 'text-base',
      spacing: 'space-y-3',
    },
    lg: {
      container: 'py-16',
      lucideWrap: 'mb-6 rounded-full bg-surface-muted p-8',
      lucideIcon: 'h-12 w-12 text-fg-subtle',
      emoji: 'text-8xl mb-6',
      title: 'text-xl font-bold',
      description: 'text-lg',
      spacing: 'space-y-4',
    },
  };

  const classes = sizeClasses[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500',
        classes.container,
        className
      )}
      role="status"
      aria-live="polite"
      dir="rtl"
    >
      <div className={classes.spacing}>
        {Lucide ? (
          <div className={cn('flex justify-center', classes.lucideWrap)} aria-hidden>
            <Lucide className={classes.lucideIcon} strokeWidth={1.75} />
          </div>
        ) : icon ? (
          <div className={cn(classes.emoji, 'text-fg-subtle drop-shadow-sm')} aria-hidden>
            {icon}
          </div>
        ) : null}

        <h3 className={cn(classes.title, 'text-fg tracking-tight')}>{title}</h3>

        {description ? (
          <p
            className={cn(
              classes.description,
              'mx-auto max-w-md leading-relaxed text-fg-muted'
            )}
          >
            {description}
          </p>
        ) : null}

        {(action || secondaryAction) && (
          <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
            {action ? (
              <Button
                onClick={action.onClick}
                variant={mapActionVariant(action.variant)}
                className="min-h-[44px] w-full sm:w-auto"
                aria-label={action.label}
              >
                {action.icon ? <span className="ms-2">{action.icon}</span> : null}
                {action.label}
              </Button>
            ) : null}

            {secondaryAction ? (
              <Button
                onClick={secondaryAction.onClick}
                variant="outline"
                className="w-full sm:w-auto"
                aria-label={secondaryAction.label}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

export function EmptyStateNoOrders({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon="📦"
      title="אין הזמנות"
      description="התחל ליצור הזמנות חדשות כדי לראות אותן כאן"
      action={
        onCreate
          ? {
              label: 'צור הזמנה חדשה',
              onClick: onCreate,
              icon: '➕',
            }
          : undefined
      }
    />
  );
}

export function EmptyStateNoCustomers({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon="👥"
      title="אין לקוחות"
      description="הוסף לקוחות כדי להתחיל לנהל את ההזמנות שלהם"
      action={
        onCreate
          ? {
              label: 'הוסף לקוח חדש',
              onClick: onCreate,
              icon: '➕',
            }
          : undefined
      }
    />
  );
}

export function EmptyStateNoProducts({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon="🛍️"
      title="אין מוצרים"
      description="הוסף מוצרים לקטלוג כדי להתחיל למכור"
      action={
        onCreate
          ? {
              label: 'הוסף מוצר חדש',
              onClick: onCreate,
              icon: '➕',
            }
          : undefined
      }
    />
  );
}

export function EmptyStateNoResults({ onReset }: { onReset?: () => void }) {
  return (
    <EmptyState
      icon="🔍"
      title="לא נמצאו תוצאות"
      description="נסה לשנות את קריטריוני החיפוש או המסננים"
      action={
        onReset
          ? {
              label: 'נקה מסננים',
              onClick: onReset,
              variant: 'secondary',
            }
          : undefined
      }
      size="sm"
    />
  );
}

export function EmptyStateNoPayments() {
  return (
    <EmptyState
      icon="💳"
      title="אין תשלומים"
      description="לא נרשמו תשלומים להזמנה זו"
      size="sm"
    />
  );
}

export function EmptyStateNoEvents({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon="📅"
      title="אין אירועים"
      description="צור אירועים חדשים כדי לנהל את לוח הזמנים"
      action={
        onCreate
          ? {
              label: 'צור אירוע',
              onClick: onCreate,
              icon: '➕',
            }
          : undefined
      }
    />
  );
}

export function EmptyStateError({
  onRetry,
  message = 'אירעה שגיאה בטעינת הנתונים',
}: {
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <EmptyState
      icon="⚠️"
      title="שגיאה"
      description={message}
      action={
        onRetry
          ? {
              label: 'נסה שוב',
              onClick: onRetry,
              variant: 'secondary',
            }
          : undefined
      }
      size="sm"
    />
  );
}

export function EmptyStateComingSoon({ featureName }: { featureName?: string }) {
  return (
    <EmptyState
      icon="🚧"
      title="בקרוב"
      description={featureName ? `${featureName} בפיתוח` : "פיצ'ר זה עדיין בפיתוח"}
      size="md"
    />
  );
}
