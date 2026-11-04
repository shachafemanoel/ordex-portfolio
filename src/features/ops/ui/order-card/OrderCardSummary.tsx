'use client';

import type { ReactNode } from 'react';
import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export type OrderCardVariant = 'orders' | 'shipments';

interface OrderCardSummaryProps {
  id: string;
  number: string;
  customerName: string | null;
  addressLine: string | null | undefined;
  isPriorityOrder: boolean;
  statusLabel: string;
  statusToneClass: string;
  /** Weekday chip for orders (no time in collapsed view) */
  compactDayLabel: string | null;
  variant?: OrderCardVariant;
  /** Shipments: time chip in header */
  timeChipLabel?: string | null;
  distanceKm?: number | null;
}

function SummaryChip({
  children,
  variant = 'muted',
  className,
}: {
  children: ReactNode;
  variant?: 'muted' | 'brand' | 'schedule' | 'distance';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[28px] shrink-0 items-center justify-center rounded-[10px] px-2.5 py-1 text-center text-[11px] font-bold leading-tight tabular-nums',
        variant === 'brand' &&
          'bg-primary-600 text-on-dark shadow-sm',
        variant === 'schedule' &&
          'border border-[color:var(--color-border-primary)] bg-primary-50 text-primary-800',
        variant === 'distance' &&
          'border border-[color:var(--color-border-primary)] bg-surface-muted text-fg-muted',
        variant === 'muted' && 'border border-subtle bg-surface-muted text-fg-muted',
        className
      )}
    >
      {children}
    </span>
  );
}

export function OrderCardSummary({
  id,
  number,
  customerName,
  addressLine,
  isPriorityOrder,
  statusLabel,
  statusToneClass,
  compactDayLabel,
  variant = 'orders',
  timeChipLabel,
  distanceKm,
}: Readonly<OrderCardSummaryProps>) {
  const isShipments = variant === 'shipments';
  const primaryLine = isShipments
    ? addressLine?.trim() || DISPLAY_TEXT.noAddress
    : customerName ?? DISPLAY_TEXT.unknownCustomer;
  const secondaryLine = isShipments
    ? customerName?.trim() || null
    : addressLine?.trim() || null;

  const metaChips: ReactNode[] = [];
  if (isShipments) {
    if (timeChipLabel) {
      metaChips.push(
        <SummaryChip key="time" variant="brand">
          {timeChipLabel}
        </SummaryChip>
      );
    }
    if (typeof distanceKm === 'number' && Number.isFinite(distanceKm)) {
      metaChips.push(
        <SummaryChip key="km" variant="distance">
          {distanceKm.toFixed(1)} ק״מ
        </SummaryChip>
      );
    }
  } else if (compactDayLabel) {
    metaChips.push(
      <SummaryChip key="day" variant="schedule">
        {compactDayLabel}
      </SummaryChip>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <Link
          href={`/orders/${id}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex min-h-[28px] items-center rounded-[10px] border border-subtle bg-surface px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-fg-muted shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-brand"
        >
          {number || id.slice(-4)}
        </Link>
        {isPriorityOrder ? (
          <EntityBadge
            label="דורש תשומת לב"
            tone="warning"
            className="min-h-[28px] px-2.5 py-1 text-[10px] font-bold shadow-sm"
          />
        ) : null}
        <span
          className={cn(
            'inline-flex min-h-[28px] items-center rounded-[10px] border px-2.5 py-1 text-[10px] font-bold shadow-sm',
            statusToneClass
          )}
        >
          {statusLabel}
        </span>
        {metaChips}
      </div>

      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold leading-snug text-fg">{primaryLine}</p>
        {secondaryLine ? (
          <p className="mt-1 truncate text-xs font-semibold leading-snug text-fg-muted">{secondaryLine}</p>
        ) : null}
      </div>
    </div>
  );
}
