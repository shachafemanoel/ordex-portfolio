'use client';

import { DashboardDeliveryMapPanel } from '@/components/dashboard/DashboardDeliveryMapPanel';
import { useDashboardDeliveryMapItems } from '@/components/dashboard/useDashboardDeliveryMapItems';
import { DeliveryMapLegendBar } from '@/components/maps/presets/DeliveryMapLegendBar';
import { MapOverlayChips } from '@/components/maps/presets/MapOverlayChips';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import Link from 'next/link';

export function DashboardOverviewMapPanel() {
  const { t } = useUITranslation();
  const { items, hotspots, insights } = useDashboardDeliveryMapItems();
  const dashboardDensityLegend = [
    { id: 'low', label: t('dashboard.overview.densityLow'), color: 'rgba(11,132,255,0.72)' },
    { id: 'medium', label: t('dashboard.overview.densityMedium'), color: 'rgba(6,182,212,0.82)' },
    { id: 'high', label: t('dashboard.overview.densityHigh'), color: 'rgba(239,68,68,0.88)' },
  ] as const;

  return (
    <section className="dashboard-panel flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
      <div className="border-b border-subtle bg-surface px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5 text-right">
            <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-fg">
              {t('dashboard.overview.mapTitle')}
            </h2>
            <p className="text-xs font-medium text-fg-muted">
              {t('dashboard.overview.mapSubtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:max-w-[72%]">
            <DeliveryMapLegendBar items={items} mapVariant="dashboard" />
            <Link
              href="/deliveries"
              className="rounded-full border border-subtle bg-surface-muted px-3.5 py-1.5 text-[11px] font-bold text-fg-muted transition hover:border-brand-soft hover:bg-[var(--color-neutral-100)] hover:text-brand-deep"
            >
              {t('dashboard.overview.linkAllDeliveries')}
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-subtle/80 pt-3 sm:flex-row sm:items-start sm:justify-between">
          <MapOverlayChips chips={insights} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dashboardDensityLegend.map((item) => (
              <div
                key={item.id}
                className="inline-flex items-center gap-2 rounded-full border border-subtle bg-surface-translucent px-3 py-1.5 text-[11px] font-bold text-fg-muted"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-map-stage min-h-[260px] flex-1 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-primary-200)_28%,transparent),transparent_54%)] sm:min-h-[320px] xl:min-h-0">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1">
          <DashboardDeliveryMapPanel compact items={items} hotspots={hotspots} />
        </div>
      </div>
    </section>
  );
}
