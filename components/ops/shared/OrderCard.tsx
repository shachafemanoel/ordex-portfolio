'use client';

import {
  OpsCardFrame,
  OpsProgressRing,
  type OpsCardTone,
} from '@/components/ops/shared/OpsCardPrimitives';
import { Badge } from '@/components/ui/Badge';
import {
  useOrderQuickActions,
  type OrderQuickAction,
  type QuickActionIntent,
} from '@/hooks/useOrderQuickActions';
import { useTranslation, useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Calendar, ChevronLeft, Coins, ExternalLink, Loader2, MapPin, Package } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

const STATUS_PROGRESS: Record<string, number> = {
  DRAFT: 0,
  TO_DO: 10,
  RECEIVED: 14,
  CALL_BACK: 18,
  PROCESSING: 24,
  CONFIRMED: 30,
  PO_CREATED: 38,
  AWAITING_STOCK: 46,
  PARTIALLY_SUPPLIED: 54,
  READY_FOR_INSTALL: 62,
  READY: 70,
  INSTALL_SCHEDULING: 74,
  AWAITING_INSTALL: 78,
  SCHEDULED: 82,
  IN_TRANSIT: 90,
  INSTALLATION: 94,
  SUPPLIED: 98,
  COMPLETED: 100,
  INVOICED: 100,
};

const DELIVERY_STATUSES = new Set([
  'READY_FOR_INSTALL',
  'READY',
  'INSTALL_SCHEDULING',
  'AWAITING_INSTALL',
  'SCHEDULED',
  'IN_TRANSIT',
  'INSTALLATION',
]);

const COMPLETED_STATUSES = new Set(['SUPPLIED', 'COMPLETED', 'INVOICED', 'INSTALLED']);
const ISSUE_STATUSES = new Set(['ON_HOLD', 'CANCELLED', 'REFUNDED']);

const INTENT_CLASSES: Record<QuickActionIntent, string> = {
  primary: 'border-transparent bg-primary-500 text-on-dark hover:bg-primary-600 active:bg-primary-600',
  success: 'border-transparent bg-[#00c853] text-on-dark hover:bg-[#00b24a] active:bg-[#009640]',
  warning: 'border-transparent bg-[#ff6d00] text-on-dark hover:bg-[#e96200] active:bg-[#d45600]',
  danger: 'border-transparent bg-[#ff3d00] text-on-dark hover:bg-[#ea3800] active:bg-[#d43200]',
  neutral: 'border-white/60 bg-white/70 text-[#34517a] hover:bg-white/80 backdrop-blur-sm',
};

function getBoardTone(status: string): OpsCardTone {
  if (COMPLETED_STATUSES.has(status)) {
    return {
      accentBar: 'bg-gradient-to-r from-[#00c853] to-[#00e676]',
      badge: 'border-white/60 bg-emerald-50/60 text-[#008c39]',
      ring: 'text-[#00c853]',
      surface: 'bg-emerald-50/40',
      border: 'border-white/60',
    };
  }

  if (ISSUE_STATUSES.has(status)) {
    return {
      accentBar: 'bg-gradient-to-r from-[#ff3d00] to-[#ff6e40]',
      badge: 'border-white/60 bg-red-50/60 text-[#db3b0a]',
      ring: 'text-[#ff3d00]',
      surface: 'bg-red-50/40',
      border: 'border-white/60',
    };
  }

  if (DELIVERY_STATUSES.has(status)) {
    return {
      accentBar: 'bg-gradient-to-r from-primary-600 to-primary-500',
      badge: 'border-white/60 bg-white/60 text-primary-600',
      ring: 'text-primary-500',
      surface: 'bg-white/50',
      border: 'border-white/60',
    };
  }

  return {
    accentBar: 'bg-gradient-to-r from-[#ff6d00] to-[#ff9100]',
    badge: 'border-white/60 bg-orange-50/60 text-[#d45f00]',
    ring: 'text-[#ff6d00]',
    surface: 'bg-orange-50/40',
    border: 'border-white/60',
  };
}

export interface OrderItemSummary {
  name: string;
  quantity: number;
}

export interface OrderSummaryData {
  id: string;
  number: string;
  customerName: string;
  isNewCustomer?: boolean;
  status: string;
  city?: string | null;
  address?: string | null;
  scheduledAt?: string | Date | null;
  itemsCount?: number;
  totalAmount?: number;
  currency?: string;
  progress?: number;
  items?: OrderItemSummary[];
  allocatedCount?: number;
  onOrderCount?: number;
}

export interface OrderCardProps {
  order: OrderSummaryData;
  onClick: () => void;
  onMouseEnter?: () => void;
  className?: string;
}

function formatCardDate(value: string | Date, localeTag: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(localeTag, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatCardAmount(amount: number, currency: string | undefined, localeTag: string): string {
  return new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: currency || 'ILS',
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface QuickActionButtonProps {
  action: OrderQuickAction;
  isPending: boolean;
  onExecute: (action: OrderQuickAction) => Promise<void>;
  locale: string;
  compact?: boolean;
}

const QuickActionButton = React.memo(function QuickActionButton({
  action,
  isPending,
  onExecute,
  locale,
  compact = false,
}: Readonly<QuickActionButtonProps>) {
  const Icon = action.icon;
  const label = locale === 'en' ? action.labelEn : action.label;
  const className = cn(
    'inline-flex items-center justify-center gap-1.5 rounded-2xl border font-bold transition-all active:scale-95 disabled:opacity-60',
    compact ? 'h-10 w-10 px-0' : 'min-h-[48px] w-full px-4 py-2.5 text-sm',
    INTENT_CLASSES[action.intent]
  );

  if (action.href) {
    return (
      <Link href={action.href} onClick={(event) => event.stopPropagation()} className={className}>
        <Icon className="h-4 w-4 shrink-0" />
        {!compact ? <span>{label}</span> : null}
        {!compact ? <ExternalLink className="h-3.5 w-3.5 opacity-70" /> : null}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending || action.disabled}
      title={action.disabledReason}
      onClick={async (event) => {
        event.stopPropagation();
        await onExecute(action);
      }}
      className={className}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 shrink-0" />
      )}
      {!compact ? <span>{label}</span> : null}
    </button>
  );
});

export function OrderCard({ order, onClick, onMouseEnter, className }: Readonly<OrderCardProps>) {
  const { t, locale, direction } = useUITranslation();
  const { t: tOrderStatus } = useTranslation('orderStatus');
  const localeTag = locale === 'en' ? 'en-US' : 'he-IL';
  const { actions, execute, isPending } = useOrderQuickActions(order.id, order.status);

  const tone = getBoardTone(order.status);
  const progress = order.progress ?? STATUS_PROGRESS[order.status] ?? 0;
  const formattedDate = order.scheduledAt ? formatCardDate(order.scheduledAt, localeTag) : '';
  const itemsList = order.items ?? [];
  const itemsCount = order.itemsCount ?? itemsList.length;
  const visibleItems = itemsList.slice(0, 3);
  const remainingItems = Math.max(itemsList.length - visibleItems.length, 0);
  const primaryAction = actions[0] ?? null;
  const secondaryActions = actions.slice(1, 3);
  const progressLabel = formattedDate ? formattedDate.split(',')[0] : `${progress}%`;
  const allocatedCount = Math.max(0, order.allocatedCount ?? 0);
  const onOrderCount = Math.max(0, order.onOrderCount ?? 0);
  const readinessLabel =
    itemsCount <= 0
      ? 'ללא פריטים'
      : allocatedCount >= itemsCount
        ? '✓ הכל מוכן'
        : allocatedCount > 0
          ? `${allocatedCount}/${itemsCount} מוכנים`
          : 'טרם הוקצה';

  return (
    <OpsCardFrame tone={tone} onClick={onClick} onMouseEnter={onMouseEnter} className={className}>
      {/* Card header */}
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-black tracking-[0.16em] text-[#5f7493] backdrop-blur-sm">
                {order.number}
              </span>
              {order.isNewCustomer ? (
                <span className="rounded-full bg-gradient-to-r from-[#e9fbf0] to-[#d4f7e5] px-2.5 py-1 text-[10px] font-black text-[#009b44]">
                  לקוח חדש ✦
                </span>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <h3 className="truncate text-lg font-black leading-tight text-[#0f172a] sm:text-xl">
                {order.customerName?.trim() || t('orders.customerFallback')}
              </h3>
              <Badge
                className={cn(
                  'inline-flex h-6 rounded-full border px-2.5 text-[10px] font-black shadow-none',
                  tone.badge
                )}
              >
                {tOrderStatus(order.status)}
              </Badge>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <OpsProgressRing
              progress={progress}
              centerLabel={progressLabel}
              toneClassName={tone.ring}
              size="md"
            />
            <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-[#93a4bf] transition-transform duration-200 group-hover:-translate-x-1" />
          </div>
        </div>

        {/* Info grid */}
        <div className={cn('grid gap-2 rounded-[20px] border p-3', tone.surface, tone.border)}>
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-[#58708f]">
              <MapPin className="h-3.5 w-3.5 text-primary-500" />
              <span className="font-bold">כתובת</span>
            </div>
            <span className="max-w-[65%] truncate text-right font-semibold text-[#0f172a]">
              {[order.city, order.address].filter(Boolean).join(', ') || 'לא צוינה'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-[#58708f]">
              <Calendar className="h-3.5 w-3.5 text-[#ff6d00]" />
              <span className="font-bold">תזמון</span>
            </div>
            <span className="font-semibold text-[#0f172a]">{formattedDate || 'ללא תזמון'}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-[#58708f]">
              <Package className="h-3.5 w-3.5 text-[#00a63e]" />
              <span className="font-bold">מוכנות</span>
            </div>
            <span className="font-semibold text-[#0f172a]">{readinessLabel}</span>
          </div>

          {onOrderCount > 0 ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-[#58708f]">
                <Package className="h-3.5 w-3.5 text-[#d45f00]" />
                <span className="font-bold">אספקה</span>
              </div>
              <span className="font-semibold text-[#0f172a]">{`${onOrderCount} בהזמנה מספק`}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Items section */}
      <div className="border-y border-white/50 bg-white/30 px-4 py-3 sm:px-5">
        <div className="space-y-2">
          {visibleItems.length > 0 ? (
            visibleItems.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="truncate font-semibold text-[#0f172a]">{item.name}</div>
                <div className="shrink-0 rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-black text-[#5f7493] shadow-sm">
                  ×{item.quantity}
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium text-[#5f7493]">
              <Package className="h-3.5 w-3.5 text-primary-500" />
              פירוט הפריטים יופיע לאחר טעינת ההזמנה
            </div>
          )}
        </div>

        {remainingItems > 0 ? (
          <div className="mt-2 text-[10px] font-black tracking-[0.14em] text-[#7b8ca8]">
            + עוד {remainingItems} פריטים
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold tracking-[0.12em] text-[#7b8ca8]">
              {t('orders.itemsCount', undefined, { params: { count: itemsCount } })}
            </div>
            <div className="flex items-center gap-1.5 text-base font-black text-[#0f172a]">
              <Coins className="h-3.5 w-3.5 text-[#ff6d00]" />
              {formatCardAmount(order.totalAmount ?? 0, order.currency, localeTag)}
            </div>
          </div>

          {secondaryActions.length > 0 ? (
            <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
              {secondaryActions.map((action) => (
                <QuickActionButton
                  key={action.id}
                  action={action}
                  isPending={isPending}
                  onExecute={execute}
                  locale={locale}
                  compact
                />
              ))}
            </div>
          ) : null}
        </div>

        {primaryAction ? (
          <div onClick={(event) => event.stopPropagation()}>
            <QuickActionButton
              action={primaryAction}
              isPending={isPending}
              onExecute={execute}
              locale={locale}
            />
          </div>
        ) : null}
      </div>
    </OpsCardFrame>
  );
}
