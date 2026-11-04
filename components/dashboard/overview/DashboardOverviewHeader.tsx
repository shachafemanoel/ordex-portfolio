'use client';

import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { Sparkles } from 'lucide-react';

export interface DashboardOverviewHeaderProps {
  userName: string;
  dateLabel: string;
}

export function DashboardOverviewHeader({
  userName,
  dateLabel,
}: Readonly<DashboardOverviewHeaderProps>) {
  const { t } = useUITranslation();
  return (
    <header className="dashboard-panel-glass relative overflow-hidden rounded-[20px] px-5 py-6 backdrop-blur-md sm:px-7 sm:py-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 h-40 w-64 rounded-full bg-gradient-to-br from-[var(--color-primary-700)]/12 via-[var(--color-primary-600)]/8 to-transparent blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-32 w-48 rounded-full bg-[color-mix(in_srgb,var(--color-neutral-400)_10%,transparent)] blur-2xl"
      />

      <div className="relative flex flex-col gap-5 text-right lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-highlight px-3 py-1.5 text-[11px] font-semibold text-fg-muted">
              <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden />
              {dateLabel}
            </span>
            <span className="dashboard-pill-glass rounded-full px-3 py-1.5 text-[11px] font-bold text-fg">
              {userName}
            </span>
          </div>

          <div className="space-y-2">
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">
              {t('dashboard.overview.workdayLabel')}
            </p>
            <h1 className="font-display text-[1.65rem] font-extrabold leading-[1.15] tracking-[-0.04em] text-fg sm:text-[2rem] lg:text-[2.2rem]">
              {t('dashboard.overview.title')}
            </h1>
            <p className="max-w-2xl text-sm font-medium leading-relaxed text-fg sm:text-[0.95rem]">
              {t('dashboard.overview.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 lg:pt-1">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-xs font-bold text-on-inverse shadow-[0_8px_24px_color-mix(in_oklab,var(--color-primary-700)_22%,transparent)]">
            <span className="bg-live-dot inline-flex h-2 w-2 rounded-full" />
            {t('dashboard.overview.liveUpdating')}
          </span>
          <span className="text-[10px] font-medium text-fg-muted">{t('dashboard.overview.focusHint')}</span>
        </div>
      </div>
    </header>
  );
}
