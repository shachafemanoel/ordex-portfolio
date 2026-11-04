'use client';

import { CustomerIdentityCard } from '@/components/shared/CustomerIdentityCard';
import { EntityBadge, EntityField, EntitySurface } from '@/components/shared/display/EntityPrimitives';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { QuickActions } from '@/components/shared/QuickActions';
import { cn } from '@/lib/utils';
import { buildStagesFromStatus } from '@/components/orders/ops/workflow/SmartStageIndicator';
import { formatOpsSchedule } from '@/components/orders/ops/workflow/utils';
import { CalendarClock, MapPin, Package } from 'lucide-react';

type SummaryOrder = {
  customer?: { id?: string | null; name?: string | null; phone?: string | null; email?: string | null } | null;
  customerName?: string | null;
  customerEmail?: string | null;
  shippingAddress?: { fullAddress?: string | null } | null;
  shippingAddressSummary?: string | null;
  addressLine?: string | null;
  scheduledAt?: string | Date | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  installAt?: string | Date | null;
  number?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  customerPhone?: string | null;
};

interface OrderSummaryCardProps {
  order: SummaryOrder;
  itemsCount: number;
  itemsSummary?: string;
  className?: string;
}

export function OrderSummaryCard({
  order,
  itemsCount,
  itemsSummary,
  className = '',
}: Readonly<OrderSummaryCardProps>) {
  const customerName = order.customer?.name ?? order.customerName ?? 'לקוח לא ידוע';
  const customerPhone = order.customer?.phone ?? order.customerPhone ?? null;
  const customerEmail = order.customer?.email ?? order.customerEmail ?? null;
  const customerHref = order.customer?.id ? `/customers/${order.customer.id}` : undefined;
  const shippingText =
    order.shippingAddress?.fullAddress ?? order.shippingAddressSummary ?? order.addressLine ?? 'ללא כתובת';
  const scheduleText = formatOpsSchedule(
    order.scheduledAt ?? order.installAt,
    order.timeWindowStart,
    order.timeWindowEnd
  );
  const stages = buildStagesFromStatus(String(order.status ?? 'TO_DO'));
  const currentStage = stages.find((stage) => stage.status === 'current') ?? stages[0];

  return (
    <EntitySurface
      className={cn(
        'p-3.5',
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-black tracking-[0.16em] text-[#8fa2bf]">{DISPLAY_TEXT.orderSummary}</div>
        {order.number ? (
          <EntityBadge label={order.number} tone="info" />
        ) : null}
        <StageDot tone={currentStage.status === 'completed' ? 'success' : currentStage.status === 'current' ? 'info' : 'neutral'} label={currentStage.label} />
      </div>

      <CustomerIdentityCard
        name={customerName}
        phone={customerPhone}
        email={customerEmail}
        href={customerHref}
        className="border-white/90 bg-white/90 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.18)]"
        meta={
          <div className="space-y-1">
            <div className="text-[10px] font-black tracking-[0.14em] text-[#8fa2bf]">{DISPLAY_TEXT.customer}</div>
            <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-slate-500">
              <Package className="h-3.5 w-3.5 text-[#7b91ad]" />
              <span>{itemsSummary ?? `${itemsCount} פריטים`}</span>
            </div>
          </div>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <QuickActions
              phoneNumber={customerPhone}
              detailsLink={customerHref}
              size="sm"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <StageDot tone="neutral" label={`${itemsCount} פריטים`} />
              {order.statusLabel ? <StageDot tone="accent" label={order.statusLabel} /> : null}
            </div>
          </div>
        }
      />

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <EntityField icon={MapPin} label={DISPLAY_TEXT.address} value={shippingText} tone="neutral" />
        <EntityField icon={CalendarClock} label={DISPLAY_TEXT.delivery} value={scheduleText} tone="info" />
      </div>
    </EntitySurface>
  );
}

function StageDot({
  tone,
  label,
}: {
  tone: 'info' | 'success' | 'neutral' | 'accent';
  label: string;
}) {
  return (
    <EntityBadge
      label={label}
      tone={tone === 'info' ? 'info' : tone === 'success' ? 'success' : tone === 'accent' ? 'accent' : 'neutral'}
      className="tracking-[0.12em]"
    />
  );
}
