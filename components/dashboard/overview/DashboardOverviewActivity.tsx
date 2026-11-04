'use client';

import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3 } from 'lucide-react';
import Link from 'next/link';

export interface DashboardOverviewActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timeLabel: string;
  statusLabel?: string;
  dueLabel?: string;
  tone: 'critical' | 'warning' | 'info';
  href: string;
}

export interface DashboardOverviewActivityProps {
  items: ReadonlyArray<DashboardOverviewActivityItem>;
}

const toneMap = {
  critical: {
    iconWrap: 'activity-tone-critical',
    icon: AlertTriangle,
  },
  warning: {
    iconWrap: 'activity-tone-warning',
    icon: Clock3,
  },
  info: {
    iconWrap: 'activity-tone-info',
    icon: CheckCircle2,
  },
} as const;

export function DashboardOverviewActivity({
  items,
}: Readonly<DashboardOverviewActivityProps>) {
  const { t } = useUITranslation();
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <section className="dashboard-panel flex h-full min-h-0 flex-col p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 border-b border-divider-light pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-fg">
          {t('dashboard.overview.activityTitle')}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/deliveries"
            className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1.5 text-[11px] font-bold text-fg-muted transition hover:bg-[var(--color-neutral-100)] hover:text-brand-deep"
          >
            <span>{t('dashboard.overview.activityDeliveriesCtaLabel')}</span>
            <ArrowLeft className="h-3 w-3" />
          </Link>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-brand transition hover:gap-2"
          >
            <span>{t('dashboard.overview.activityCtaLabel')}</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {safeItems.length ? (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
          {safeItems.map((item, index) => {
            const tone = toneMap[item.tone as keyof typeof toneMap];
            const Icon = tone.icon;
            const isLast = index === safeItems.length - 1;

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={t('dashboard.overview.openTaskAria', undefined, { params: { title: item.title } })}
                className={[
                  'group flex gap-3 rounded-2xl p-3 text-inherit no-underline transition',
                  'bg-surface-page-wash/50 hover:bg-surface-muted',
                  !isLast ? 'mb-1' : '',
                ].join(' ')}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div
                  className={[
                    'min-w-0 flex-1 space-y-1 pb-2 text-right',
                    !isLast ? 'border-b border-divider-light' : '',
                  ].join(' ')}
                >
                  <p className="truncate font-display text-sm font-bold text-fg">{item.title}</p>
                  <p className="truncate text-[13px] text-fg-muted" dir="auto">
                    {item.subtitle}
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                    {item.statusLabel ? (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-fg-subtle">
                        {item.statusLabel}
                      </span>
                    ) : null}
                    {item.dueLabel ? (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                        {item.dueLabel}
                      </span>
                    ) : null}
                    <span className="text-[11px] font-medium text-fg-subtle">{item.timeLabel}</span>
                  </div>
                  <div className="pt-1.5">
                    <span className="inline-flex rounded-full border border-brand-soft bg-info-soft px-2.5 py-1 text-[10px] font-extrabold text-brand">
                      {t('dashboard.overview.handleNow')}
                    </span>
                  </div>
                </div>
                <ArrowLeft className="text-icon-muted mt-2 h-4 w-4 shrink-0 opacity-35 transition group-hover:opacity-70" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-muted px-4 py-8 text-center">
          <p className="font-display text-sm font-bold text-fg">
            {t('dashboard.overview.activityEmptyTitle')}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            {t('dashboard.overview.activityEmptyDescription')}
          </p>
        </div>
      )}
    </section>
  );
}
