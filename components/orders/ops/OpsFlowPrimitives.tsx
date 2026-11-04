'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type OpsAccent = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const ACCENT_STYLES: Record<
  OpsAccent,
  {
    hero: string;
    heroText: string;
    iconWrap: string;
    icon: string;
    tile: string;
    activeOption: string;
    button: string;
  }
> = {
  primary: {
    hero: 'border-primary-100 bg-primary-50 shadow-sm',
    heroText: 'text-primary-600',
    iconWrap: 'bg-white',
    icon: 'text-primary-600',
    tile: 'border-primary-100 bg-white text-primary-600 hover:bg-primary-50',
    activeOption: 'border-primary-100 bg-primary-50',
    button: 'bg-primary-500 text-on-dark hover:bg-primary-600',
  },
  success: {
    hero: 'border-emerald-200 bg-emerald-50/80 shadow-sm',
    heroText: 'text-[#008c39]',
    iconWrap: 'bg-white',
    icon: 'text-[#008c39]',
    tile: 'border-emerald-100 bg-white text-[#008c39] hover:bg-emerald-50',
    activeOption: 'border-emerald-200 bg-emerald-50/80',
    button: 'bg-[#00c853] text-on-dark hover:bg-[#00b24a]',
  },
  warning: {
    hero: 'border-[#ffd9bf] bg-[#fff6ed] shadow-sm',
    heroText: 'text-[#d45f00]',
    iconWrap: 'bg-white',
    icon: 'text-[#d45f00]',
    tile: 'border-[#ffd9bf] bg-white text-[#d45f00] hover:bg-[#fff6ed]',
    activeOption: 'border-[#ffd9bf] bg-[#fff6ed]',
    button: 'bg-[#ff6d00] text-on-dark hover:bg-[#e96200]',
  },
  danger: {
    hero: 'border-[#ffd9bf] bg-[#fff1e6] shadow-sm',
    heroText: 'text-[#d45f00]',
    iconWrap: 'bg-white',
    icon: 'text-[#d45f00]',
    tile: 'border-[#ffd9bf] bg-white text-[#d45f00] hover:bg-[#fff6ed]',
    activeOption: 'border-[#ffd9bf] bg-[#fff1e6]',
    button: 'bg-[#ff3d00] text-on-dark hover:bg-[#ea3800]',
  },
  neutral: {
    hero: 'border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-sm',
    heroText: 'text-[#475569]',
    iconWrap: 'bg-white',
    icon: 'text-[#475569]',
    tile: 'border-slate-200 bg-white text-[#475569] hover:bg-slate-50',
    activeOption: 'border-slate-200 bg-slate-50',
    button: 'bg-[#0f172a] text-on-dark hover:bg-[#1e293b]',
  },
};

export function OpsFlowHero({
  accent = 'primary',
  icon: Icon,
  title,
  description,
  aside,
}: Readonly<{
  accent?: OpsAccent;
  icon: LucideIcon;
  title: string;
  description: string;
  aside?: ReactNode;
}>) {
  const tone = ACCENT_STYLES[accent];

  return (
    <div className={cn('rounded-[22px] border p-4', tone.hero)}>
      <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', tone.iconWrap)}
          >
            <Icon className={cn('h-5 w-5', tone.icon)} />
          </div>
          <div className="space-y-1">
            <div className={cn('text-sm font-black', tone.heroText)}>{title}</div>
            <div className="min-w-0 break-words text-xs font-medium leading-5 text-slate-600">{description}</div>
          </div>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </div>
  );
}

export function OpsFlowActionTile({
  accent = 'primary',
  icon: Icon,
  title,
  description,
  active = false,
  onClick,
}: Readonly<{
  accent?: OpsAccent;
  icon: LucideIcon;
  title: string;
  description: string;
  active?: boolean;
  onClick: () => void;
}>) {
  const tone = ACCENT_STYLES[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2.5 rounded-[20px] border p-3.5 text-right transition-all duration-200 active:scale-[0.96] sm:gap-3 sm:p-4',
        active
          ? cn(tone.tile, 'shadow-md')
          : 'border-slate-200 bg-white text-[#475569] hover:bg-slate-50 hover:shadow-sm'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl',
          tone.icon
        )}
      >
        <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
      </div>
      <div className="space-y-0.5 sm:space-y-1">
        <div className="text-xs font-black sm:text-sm">{title}</div>
        <div className="text-[10px] font-medium leading-4 opacity-80 sm:text-[11px] sm:leading-5">{description}</div>
      </div>
    </button>
  );
}

export function OpsFlowOption({
  accent = 'primary',
  icon: Icon,
  title,
  description,
  active = false,
  trailing,
  children,
  className,
}: Readonly<{
  accent?: OpsAccent;
  icon: LucideIcon;
  title: string;
  description?: string;
  active?: boolean;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
}>) {
  const tone = ACCENT_STYLES[accent];

  return (
    <div
      className={cn(
        'rounded-[20px] border bg-white p-4 transition-all shadow-sm',
        active ? tone.activeOption : 'border-slate-200',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl',
              tone.iconWrap
            )}
          >
            <Icon className={cn('h-4.5 w-4.5', tone.icon)} />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-bold text-[#0f172a]">{title}</div>
            {description ? (
              <div className="min-w-0 break-words text-[12px] font-medium leading-5 text-slate-500">{description}</div>
            ) : null}
          </div>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function OpsFlowPrimaryButton({
  accent = 'primary',
  icon: Icon,
  children,
  disabled,
  loading = false,
  onClick,
}: Readonly<{
  accent?: OpsAccent;
  icon?: LucideIcon;
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}>) {
  const tone = ACCENT_STYLES[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] px-6 py-4 text-sm font-black shadow-lg transition-all active:scale-[0.98]',
        disabled ? 'cursor-not-allowed bg-[#e2e8f0] text-[#94a3b8] shadow-none' : tone.button
      )}
    >
      {Icon ? <Icon className={cn('h-5 w-5', loading && 'animate-spin')} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function OpsFlowNote({
  children,
  className,
}: Readonly<{
  children: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'rounded-[18px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-[12px] font-medium leading-5 text-slate-500',
        className
      )}
    >
      {children}
    </div>
  );
}
