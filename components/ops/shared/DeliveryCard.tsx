'use client';

import { EntityActionButton, EntityActionLink, EntityBadge, EntityField, EntitySurface } from '@/components/shared/display/EntityPrimitives';
import { getDeliveryOperationalDisplay, getEntityToneDotClass } from '@/components/shared/display/displayStatus';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import {
  formatDisplayAddress,
  formatDisplayItemCount,
  formatDisplayPhoneHref,
  formatDisplayTime,
} from '@/components/shared/display/displayFormatters';
import { useState } from 'react';

import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  ChevronDown,
  Clock3,
  Loader2,
  Navigation,
  Package,
  Phone,
  Truck,
} from 'lucide-react';

const START_DELIVERY_STATUSES = new Set([
  'AWAITING_INSTALL',
  'SCHEDULED',
  'READY_FOR_INSTALL',
  'INSTALL_SCHEDULING',
  'READY',
]);
const DISPATCHABLE_STATUSES = new Set([
  'AWAITING_INSTALL',
  'SCHEDULED',
  'READY_FOR_INSTALL',
  'INSTALL_SCHEDULING',
  'READY',
]);
const MARK_DELIVERED_STATUSES = new Set(['IN_TRANSIT', 'INSTALLATION']);

export interface DeliveryCardProps {
  order: {
    id: string;
    number: string;
    customerName: string;
    customerPhone?: string | null;
    status: string;
    addressLine: string;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
    scheduledAt?: string | Date | null;
    estimatedArrivalAt?: string | Date | null;
    estimatedCompletionAt?: string | Date | null;
    itemsSummary?: string | null;
    itemLabels?: string[];
    itemsCount?: number | null;
    etaMinutes?: number | null;
    distanceKm?: number | null;
    routeIndex?: number | null;
    notes?: string | null;
  };
  onClick: () => void;
  onStartDelivery?: (orderId: string) => void;
  onMarkDelivered?: (orderId: string) => void;
  isStatusChanging?: boolean;
  className?: string;
}

function getOrderSuffix(orderNumber: string): string {
  const digitsOnly = orderNumber.replace(/\D/g, '');
  if (digitsOnly.length >= 3) return digitsOnly.slice(-3);
  return orderNumber.slice(-3);
}

export function DeliveryCard({
  order,
  onClick,
  onStartDelivery,
  onMarkDelivered,
  isStatusChanging = false,
  className,
}: DeliveryCardProps) {
  const { t } = useUITranslation();
  const [actionsOpen, setActionsOpen] = useState(false);

  const canStartDelivery = DISPATCHABLE_STATUSES.has(order.status) && Boolean(order.scheduledAt);
  const canMarkDelivered = MARK_DELIVERED_STATUSES.has(order.status);
  const needsScheduling = START_DELIVERY_STATUSES.has(order.status) && !order.scheduledAt;

  const actionLabel = needsScheduling
    ? 'תיאום מסירה'
    : canStartDelivery
      ? t('deliveries.action.startDelivery')
      : canMarkDelivered
        ? t('deliveries.action.markDelivered')
        : 'צפייה בפרטים';

  const wazeLink =
    order.lat && order.lng
      ? `https://waze.com/ul?ll=${order.lat},${order.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(
          order.addressLine + (order.city ? `, ${order.city}` : '')
        )}`;

  const contactHref = formatDisplayPhoneHref(order.customerPhone);
  const numberSuffix = getOrderSuffix(order.number);
  const arrivalLabel = formatDisplayTime(order.estimatedArrivalAt ?? order.scheduledAt);
  const operationalStatus = getDeliveryOperationalDisplay({
    status: order.status,
    scheduledAt: order.scheduledAt,
  });
  const cardToneClass = canMarkDelivered
    ? 'border-[#cfe4ff] bg-[linear-gradient(180deg,#ffffff_0%,#edf2ff_100%)]'
    : needsScheduling
      ? 'border-[#ffd9bf] bg-[linear-gradient(180deg,#fffdfb_0%,#fff3e7_100%)]'
      : 'border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]';

  return (
    <EntitySurface
      className={cn(
        'relative w-full overflow-hidden text-right font-sans',
        cardToneClass,
        className
      )}
    >
      <button
        type="button"
        onClick={() => setActionsOpen((open) => !open)}
        aria-expanded={actionsOpen}
        className="flex w-full items-start gap-3 px-4 py-4 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35 focus-visible:ring-inset"
      >
        {typeof order.routeIndex === 'number' ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[13px] font-black text-on-dark">
            {order.routeIndex}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <EntityBadge label={`#${numberSuffix}`} tone="accent" />
            <EntityBadge
              label={operationalStatus.label}
              tone={operationalStatus.tone}
              dotClassName={getEntityToneDotClass(operationalStatus.tone)}
            />
            {order.notes?.trim() ? (
              <EntityBadge label={DISPLAY_TEXT.destinationNote} tone="warning" />
            ) : null}
          </div>

          <p className="mt-2 truncate text-[16px] font-bold leading-5 text-slate-900">
            {order.customerName || t('deliveries.unknownCustomer')}
          </p>
          <p className="mt-1 truncate text-[13px] font-medium text-slate-600">
            {formatDisplayAddress(order.addressLine, order.city)}
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <EntityField icon={Clock3} label={DISPLAY_TEXT.eta} value={arrivalLabel ? `ETA ${arrivalLabel}` : DISPLAY_TEXT.noEta} tone="info" />
            <EntityField label="מרחק" value={typeof order.distanceKm === 'number' ? `${order.distanceKm} ק״מ` : 'לא חושב'} tone="neutral" />
            <EntityField icon={Package} label={DISPLAY_TEXT.items} value={formatDisplayItemCount(order.itemsCount)} tone="neutral" />
          </div>

          {order.notes?.trim() ? (
            <EntityField label={DISPLAY_TEXT.notes} value={order.notes.trim()} tone="warning" className="mt-3" />
          ) : null}
        </div>

        <a
          href={wazeLink}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-500 text-on-dark shadow-[0_4px_12px_rgba(0,133,255,0.3)] transition-colors hover:bg-primary-600"
          aria-label="ניווט לכתובת"
        >
          <Navigation className="h-4 w-4" />
        </a>

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            actionsOpen && 'rotate-180'
          )}
        />
      </button>

      {actionsOpen ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          {order.itemsSummary ? (
            <div className="mb-3 rounded-[18px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[12px] font-semibold text-slate-600">
              {order.itemsSummary}
            </div>
          ) : null}
          {order.customerPhone ? (
            <p className="mb-3 text-[12px] font-semibold text-slate-500">{order.customerPhone}</p>
          ) : null}

          <div className="flex items-center gap-2">
            <EntityActionButton
              type="button"
              disabled={isStatusChanging}
              onClick={() => {
                if (needsScheduling) onClick();
                else if (canStartDelivery) onStartDelivery?.(order.id);
                else if (canMarkDelivered) onMarkDelivered?.(order.id);
                else onClick();
              }}
              className={cn('h-11 flex-1', isStatusChanging && 'opacity-70')}
            >
              {isStatusChanging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : canMarkDelivered ? (
                <CheckCircle className="h-4 w-4" />
              ) : canStartDelivery ? (
                <Truck className="h-4 w-4" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              <span>{actionLabel}</span>
            </EntityActionButton>

            {contactHref ? (
              <EntityActionLink
                href={contactHref}
                tone="secondary"
                className="h-11 min-w-[52px] px-3.5"
              >
                <Phone className="h-4 w-4" />
              </EntityActionLink>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-11 min-w-[52px] items-center justify-center rounded-xl border border-slate-200 bg-[#F8F9FA] px-3.5 text-slate-400"
              >
                <Phone className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : null}
    </EntitySurface>
  );
}
