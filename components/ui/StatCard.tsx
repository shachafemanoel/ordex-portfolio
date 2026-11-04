'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type UrgencyLevel = 'critical' | 'high' | 'medium' | 'normal' | 'done';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  /** Optional trend indicator: positive/negative/neutral */
  trend?: 'up' | 'down' | 'neutral';
  /** Optional trend value text e.g. "+12%" */
  trendLabel?: string;
  /** Urgency level changes the left border color */
  urgency?: UrgencyLevel;
  /** Highlight the card as requiring action */
  actionRequired?: boolean;
  className?: string;
}

const URGENCY_BORDER: Record<UrgencyLevel, string> = {
  critical: 'border-s-[8px] border-s-[#ff0033]',
  high:     'border-s-[8px] border-s-[#fbbf24]',
  medium:   'border-s-[8px] border-s-[#0055ff]',
  normal:   'border-s-[8px] border-s-black dark:border-s-white',
  done:     'border-s-[8px] border-s-[#10b981]',
};

const ICON_BG: Record<UrgencyLevel, string> = {
  critical: 'bg-[var(--color-danger-600)]/10 text-[var(--color-danger-600)]',
  high:     'bg-[var(--color-warning-600)]/10 text-[var(--color-warning-600)]',
  medium:   'bg-[var(--color-primary-600)]/10 text-[var(--color-primary-600)]',
  normal:   'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]',
  done:     'bg-[var(--color-success-600)]/10 text-[var(--color-success-600)]',
};

const TREND_STYLES = {
  up:      'text-[#10b981] bg-white border-2 border-[#10b981]',
  down:    'text-[#ff0033] bg-white border-2 border-[#ff0033]',
  neutral: 'text-black bg-white border-2 border-black',
};

const TREND_ARROWS = { up: '↑', down: '↓', neutral: '→' };

export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  trendLabel,
  urgency = 'normal',
  actionRequired = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'ordex-card relative flex flex-col gap-2.5 overflow-hidden',
        URGENCY_BORDER[urgency],
        actionRequired && 'action-required',
        className
      )}
    >
      {/* Top row: title + icon */}
      <div className="flex items-start justify-between gap-2">
        <p
          className="font-black uppercase tracking-tighter text-slate-600 dark:text-slate-400"
          style={{ fontSize: 'var(--font-label)' }}
        >
          {title}
        </p>
        {icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-2 border-black dark:border-white transition-transform duration-200',
              ICON_BG[urgency]
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Metric value — fluid size */}
      <p
        className="font-extrabold leading-none tracking-tight text-[var(--color-text-primary)]"
        style={{ fontSize: 'var(--fluid-metric-value)' }}
      >
        {value}
      </p>

      {/* Footer row: description + trend */}
      {(description || trend) && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
          {description && (
            <p className="min-w-0 truncate text-[var(--font-caption)] font-medium text-text-secondary/80">
              {description}
            </p>
          )}
          {trend && trendLabel && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-none px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter',
                TREND_STYLES[trend]
              )}
            >
              <span>{TREND_ARROWS[trend]}</span>
              {trendLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
