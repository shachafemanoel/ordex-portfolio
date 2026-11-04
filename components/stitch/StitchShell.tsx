import { cn } from '@/lib/utils';
import {
  PageScaffold,
  PageScaffoldHeader,
  PageScaffoldPanel,
} from '@/components/layout/shell/PageScaffold';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface StitchPageShellProps {
  children: ReactNode;
  className?: string;
}

export function StitchPageShell({ children, className }: Readonly<StitchPageShellProps>) {
  return <PageScaffold surface className={className}>{children}</PageScaffold>;
}

export interface StitchPageHeaderProps {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
}

export function StitchPageHeader({
  title,
  description,
  meta,
  actions,
  tabs,
  className,
}: Readonly<StitchPageHeaderProps>) {
  return (
    <PageScaffoldHeader
      title={title}
      description={description}
      meta={meta}
      actions={actions}
      tabs={tabs}
      className={className}
    />
  );
}

const toneClasses = {
  primary: {
    surface: 'tone-accent',
    hint: 'text-[var(--tone-accent-text)]',
  },
  success: {
    surface: 'tone-success',
    hint: 'text-[var(--tone-success-text)]',
  },
  warning: {
    surface: 'tone-warning',
    hint: 'text-[var(--tone-warning-text)]',
  },
  info: {
    surface: 'tone-info',
    hint: 'text-[var(--tone-info-text)]',
  },
  neutral: {
    surface: 'surface-card text-[var(--color-text-secondary)]',
    hint: 'text-[var(--color-text-secondary)]',
  },
} as const;

export interface StitchStatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof toneClasses;
  className?: string;
}

export function StitchStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  className,
}: Readonly<StitchStatCardProps>) {
  return (
    <article
      className={cn(
        'app-shell-surface border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 shadow-[var(--shadow-sm)] sm:p-4',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-[var(--color-text-secondary)] sm:text-xs">{label}</p>
          <div className="text-fluid-metric font-black tracking-[-0.03em] text-[var(--color-text-primary)] [font-family:var(--font-display)]">
            {value}
          </div>
          {hint ? (
            <div className={cn('text-[11px] font-bold', toneClasses[tone].hint)}>{hint}</div>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border sm:h-10 sm:w-10',
              toneClasses[tone].surface
            )}
          >
            <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export interface StitchPanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function StitchPanel({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: Readonly<StitchPanelProps>) {
  return (
    <PageScaffoldPanel className={className}>
      {title || description || actions ? (
        <div className="flex flex-col gap-3 border-b border-[var(--color-border-primary)] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <h2 className="text-fluid-section-title font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-[12px] font-medium text-[var(--color-text-secondary)] sm:text-sm">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn('p-4 sm:p-5', contentClassName)}>{children}</div>
    </PageScaffoldPanel>
  );
}

export interface StitchTabButtonProps {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function StitchTabButton({
  active = false,
  children,
  onClick,
  className,
}: Readonly<StitchTabButtonProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
        active
          ? 'tone-accent'
          : 'border-transparent bg-[var(--card-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-primary)] hover:text-[var(--color-text-primary)]',
        className
      )}
    >
      {children}
    </button>
  );
}
