'use client';

import type { DeliveryMapPoint } from '@/components/ops/shared/DeliveriesMapboxCanvas';
import { isReadyForShipment } from '@/lib/delivery-map-status';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, MapPin, Package, Truck } from 'lucide-react';

interface DeliveryMapLegendBarProps {
  items?: ReadonlyArray<DeliveryMapPoint> | null;
  mapVariant: 'dashboard' | 'field';
  className?: string;
}

function hasCoordinates(item: DeliveryMapPoint) {
  return typeof item.lat === 'number' && typeof item.lng === 'number';
}

function isOverdue(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

export function DeliveryMapLegendBar({
  items,
  mapVariant,
  className,
}: Readonly<DeliveryMapLegendBarProps>) {
  const { t } = useUITranslation();
  const safeItems = Array.isArray(items) ? items : [];
  const mappedCount = safeItems.filter(hasCoordinates).length;
  const plannedTodayCount = safeItems.filter((item) => item.markerTone === 'planned-today').length;
  const completedTodayCount = safeItems.filter(
    (item) => item.markerTone === 'completed-today'
  ).length;
  const readyForShipmentCount = safeItems.filter(isReadyForShipment).length;
  const inTransitCount = safeItems.filter(
    (item) => item.status === 'IN_TRANSIT' || item.status === 'INSTALLATION'
  ).length;
  const overdueCount = safeItems.filter(
    (item) => item.markerTone !== 'completed-today' && isOverdue(item.scheduledAt)
  ).length;
  const missingLocationCount = safeItems.length - mappedCount;

  const fieldAttention =
    missingLocationCount > 0
      ? { kind: 'missing' as const, value: missingLocationCount }
      : overdueCount > 0
        ? { kind: 'overdue' as const, value: overdueCount }
        : null;

  const chips =
    mapVariant === 'dashboard'
      ? [
          {
            id: 'planned',
            label: t('maps.legend.dashboard.plannedToday'),
            value: plannedTodayCount,
            icon: Truck,
            tone: 'bg-primary-50 text-primary-700 ring-primary-200',
          },
          {
            id: 'completed',
            label: t('maps.legend.dashboard.completedToday'),
            value: completedTodayCount,
            icon: CheckCircle2,
            tone: 'bg-success-50 text-success-700 ring-success-600/25',
          },
          {
            id: 'ready',
            label: t('maps.legend.dashboard.readyShipment'),
            value: readyForShipmentCount,
            icon: Package,
            tone: 'bg-warning-50 text-warning-700 ring-warning-500/30',
          },
          {
            id: 'mapped',
            label: t('maps.legend.dashboard.withLocation'),
            value: mappedCount,
            icon: MapPin,
            tone: 'bg-surface-muted text-fg-muted ring-subtle',
          },
        ]
      : [
          {
            id: 'transit',
            label: t('maps.legend.field.inTransit'),
            value: inTransitCount,
            icon: Truck,
            tone: 'bg-warning-50 text-warning-700 ring-warning-500/30',
          },
          {
            id: 'mapped',
            label: t('maps.legend.field.withLocation'),
            value: mappedCount,
            icon: MapPin,
            tone: 'bg-primary-50 text-primary-700 ring-primary-200',
          },
          ...(fieldAttention
            ? [
                {
                  id: 'attention',
                  label:
                    fieldAttention.kind === 'missing'
                      ? t('maps.legend.field.missingPoints')
                      : t('maps.legend.field.overdue'),
                  value: fieldAttention.value,
                  icon: AlertTriangle,
                  tone: 'bg-warning-50 text-warning-800 ring-warning-600/35',
                },
              ]
            : []),
        ];

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <div
            key={chip.id}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 ring-inset',
              chip.tone
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
            <span>{chip.label}</span>
            <span className="rounded-full bg-surface/90 px-1.5 py-0.5 text-[10px] font-black text-fg tabular-nums">
              {chip.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
