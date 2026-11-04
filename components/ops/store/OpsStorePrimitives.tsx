'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

type StoreTone = 'primary' | 'warning' | 'success' | 'neutral';

const TONE_STYLES: Record<
  StoreTone,
  {
    icon: string;
    text: string;
    surface: string;
    border: string;
  }
> = {
  primary: {
    icon: 'bg-[var(--color-primary-50)] text-[var(--color-primary-500)]',
    text: 'text-brand',
    surface: 'bg-[var(--color-primary-50)]',
    border: 'border-[var(--color-primary-200)]',
  },
  warning: {
    icon: 'bg-[var(--color-warning-50)] text-[var(--color-warning-500)]',
    text: 'text-accent',
    surface: 'bg-[var(--color-warning-50)]',
    border: 'border-[var(--color-warning-200)]',
  },
  success: {
    icon: 'bg-[var(--color-success-50)] text-[var(--color-success-600)]',
    text: 'text-[var(--color-success-700)]',
    surface: 'bg-[var(--color-success-50)]',
    border: 'border-[var(--color-success-200)]',
  },
  neutral: {
    icon: 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]',
    text: 'text-brand-deep',
    surface: 'bg-surface',
    border: 'border-[var(--color-primary-200)]',
  },
};

interface OpsStoreSignalProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: StoreTone;
}

export function OpsStoreSignal({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: Readonly<OpsStoreSignalProps>) {
  const styles = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.22)] sm:px-3 sm:py-2',
        styles.border,
        styles.surface
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8',
          styles.icon
        )}
      >
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
      <span className="text-[10px] font-semibold text-ops-muted sm:text-[11px]">{label}</span>
      <span className={cn('text-[13px] font-black sm:text-sm', styles.text)}>{value}</span>
    </div>
  );
}

interface OpsStoreMiniCardContentProps {
  icon: LucideIcon;
  title: string;
  subtitle: ReactNode;
  value?: ReactNode;
  tone?: StoreTone;
  trailing?: ReactNode;
}

function OpsStoreMiniCardContent({
  icon: Icon,
  title,
  subtitle,
  value,
  tone = 'neutral',
  trailing,
}: Readonly<OpsStoreMiniCardContentProps>) {
  const styles = TONE_STYLES[tone];

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', styles.icon)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex items-center gap-2">
          {value ? <span className={cn('text-xl font-black', styles.text)}>{value}</span> : null}
          {trailing}
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="text-sm font-black text-fg">{title}</div>
        <div className="text-xs font-semibold leading-5 text-ops-muted">{subtitle}</div>
      </div>
    </>
  );
}

interface OpsStoreMiniCardProps extends OpsStoreMiniCardContentProps {
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function OpsStoreMiniCard({
  href,
  onClick,
  className,
  ...contentProps
}: Readonly<OpsStoreMiniCardProps>) {
  const styles = TONE_STYLES[contentProps.tone ?? 'neutral'];
  const baseClassName = cn(
    'app-shell-surface border p-3 text-right shadow-[0_18px_44px_-24px_rgba(15,23,42,0.12)] transition-all sm:p-4',
    styles.border,
    styles.surface,
    (href || onClick) &&
      'hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-24px_rgba(15,23,42,0.16)]',
    className
  );

  if (href) {
    return (
      <Link href={href} className={cn(baseClassName, 'block')}>
        <OpsStoreMiniCardContent
          {...contentProps}
          trailing={<ArrowLeft className="h-4 w-4 shrink-0 text-ops-muted" />}
        />
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(baseClassName, 'w-full')}>
        <OpsStoreMiniCardContent {...contentProps} />
      </button>
    );
  }

  return (
    <div className={baseClassName}>
      <OpsStoreMiniCardContent {...contentProps} />
    </div>
  );
}

export interface OpsStoreFloatingNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}

interface OpsStoreFloatingNavProps {
  items: OpsStoreFloatingNavItem[];
  className?: string;
}

export function OpsStoreFloatingNav({ items, className }: Readonly<OpsStoreFloatingNavProps>) {
  return (
    <nav
      className={cn(
        'fixed bottom-3 left-1/2 z-40 flex w-[min(94vw,720px)] -translate-x-1/2 items-center justify-between gap-1 rounded-full border border-surface-strong bg-surface-translucent-strong px-2 py-2 shadow-[0_24px_54px_-24px_rgba(15,23,42,0.26)] backdrop-blur-xl sm:bottom-4 sm:px-3',
        className
      )}
      aria-label="Store sections"
    >
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[10px] font-black transition-all sm:py-2',
              item.active
                ? 'bg-primary-50 text-brand'
                : 'text-ops-icon-muted hover:bg-[var(--color-primary-50)] hover:text-brand-deep'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
