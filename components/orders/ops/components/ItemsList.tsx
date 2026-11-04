'use client';

import {
  EntityBadge,
  EntityField,
  EntityNotice,
  EntitySurface,
} from '@/components/shared/display/EntityPrimitives';
import { CheckCircle2, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OpsItem } from '../workflow/types';
import { getItemStateLabel } from '../workflow/utils';

interface ItemsListProps {
  items: OpsItem[];
}

export function ItemsList({ items }: ItemsListProps) {
  if (items.length === 0) {
    return (
      <EntityNotice
        icon={Package}
        title="אין פריטים בהזמנה זו"
        description="אין כרגע פריטים להצגה או לעיבוד במסך הזה."
        tone="neutral"
        className="border-dashed px-4 py-6 text-center"
      />
    );
  }

  const readyItems = items.filter((item) => getItemStateLabel(item).variant === 'success');
  const onOrderCount = items.filter((item) => getItemStateLabel(item).variant === 'warning').length;
  const pendingCount = items.length - readyItems.length - onOrderCount;

  return (
    <EntitySurface className="overflow-hidden">
      <div className="space-y-2 border-b border-slate-200 bg-[#f8fbff] px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-sm font-black tracking-tight text-slate-900">
            <Package className="h-3.5 w-3.5 text-primary-500" />
            תמונת מצב פריטים
          </h3>
          <EntityBadge label={`${items.length} פריטים`} tone="neutral" size="sm" />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <SummaryChip label="ממתינים" value={pendingCount} tone="info" />
          <SummaryChip label="ברכש" value={onOrderCount} tone="warning" />
          <SummaryChip label="זמינים" value={readyItems.length} tone="success" />
        </div>
      </div>

      {readyItems.length === items.length ? (
        <EntityNotice
          icon={CheckCircle2}
          title="כל הפריטים מוכנים"
          description="אין צורך לעבור פריט־פריט במסך הזה."
          tone="success"
          className="m-4"
        />
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const stateLabel = getItemStateLabel(item);
            const isSuccess = stateLabel.variant === 'success';
            const isWarning = stateLabel.variant === 'warning';
            const stockLabel = isSuccess
              ? 'קיים במלאי'
              : isWarning
                ? 'ממתין לאספקה'
                : 'דורש החלטת מלאי';
            return (
              <div key={item.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <div
                  className={cn(
                    'h-9 w-1 shrink-0 rounded-full',
                    isSuccess ? 'bg-emerald-400' : isWarning ? 'bg-orange-300' : 'bg-[#67a9ff]'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900">{item.name}</span>
                    <EntityBadge label={item.sku || 'N/A'} tone="neutral" size="sm" />
                    <EntityBadge label={`×${item.quantity}`} tone="info" size="sm" />
                  </div>
                  {item.supplierName && !isSuccess ? (
                    <div className="mt-2">
                      <EntityField icon={Truck} label="ספק" value={item.supplierName} />
                    </div>
                  ) : null}
                </div>
                <EntityBadge
                  label={stockLabel}
                  tone={isSuccess ? 'success' : isWarning ? 'warning' : 'info'}
                  size="sm"
                />
              </div>
            );
          })}
        </div>
      )}
    </EntitySurface>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'info' | 'warning' | 'success';
}) {
  return <EntityBadge label={`${label} ${value}`} tone={tone} size="sm" />;
}
