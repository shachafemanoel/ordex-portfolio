'use client';

import { memo, useMemo } from 'react';
import { EntityBadge, EntityField } from '@/components/shared/display/EntityPrimitives';
import { getEntityToneDotClass, getOrderStatusDisplay } from '@/components/shared/display/displayStatus';
import type { OrderWithRelations } from '@/lib/api/types';
import { formatOpsSchedule } from '@/components/orders/ops/workflow/utils';
import { cn } from '@/lib/utils';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  PackageCheck,
  ShoppingCart,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ActivityOrder = Pick<
  OrderWithRelations,
  'items' | 'noteEntries' | 'notesToCrew' | 'scheduledAt' | 'statusHistory' | 'timeWindowStart' | 'timeWindowEnd'
>;

type ActivityEntry =
  | {
      id: string;
      kind: 'status';
      at: number;
      atLabel: string;
      icon: LucideIcon;
      title: string;
      description?: string;
      actor?: string | null;
      status: string;
    }
  | {
      id: string;
      kind: 'note' | 'schedule';
      at: number;
      atLabel: string;
      icon: LucideIcon;
      title: string;
      description?: string;
      actor?: string | null;
    };

function formatDateTime(value?: string | null) {
  if (!value) return 'לא זמין';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'לא זמין';

  return date.toLocaleString('he-IL', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isManualOverride(metadata: unknown) {
  return Boolean(metadata && typeof metadata === 'object' && (metadata as { manualOverride?: unknown }).manualOverride);
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function OrderActivityFeedInner({ order }: Readonly<{ order: ActivityOrder }>) {
  const itemMetrics = useMemo(() => {
    const total = order.items?.length ?? 0;
    const ready = (order.items ?? []).filter(
      (item) =>
        item.allocationStatus === 'ALLOCATED' ||
        item.received ||
        item.receivedQuantity >= item.quantity
    ).length;
    const waiting = (order.items ?? []).filter(
      (item) =>
        item.allocationStatus === 'ON_ORDER' || item.allocationStatus === 'OUT_OF_STOCK'
    ).length;

    return {
      total,
      ready,
      waiting,
      pending: Math.max(total - ready - waiting, 0),
    };
  }, [order.items]);

  const activityItems = useMemo(() => {
    const items: ActivityEntry[] = [];

    for (const entry of order.statusHistory ?? []) {
      items.push({
        id: `status-${entry.id}`,
        kind: 'status',
        at: toTimestamp(entry.createdAt),
        atLabel: formatDateTime(entry.createdAt),
        icon: ClipboardList,
        title: isManualOverride(entry.metadata) ? 'סטטוס עודכן בעקיפת תנאים (מנהל)' : 'סטטוס ההזמנה עודכן',
        description: entry.reason ?? undefined,
        actor: entry.changedByUser?.name ?? null,
        status: entry.toStatus,
      });
    }

    for (const entry of order.noteEntries ?? []) {
      items.push({
        id: `note-${entry.id}`,
        kind: 'note',
        at: toTimestamp(entry.createdAt),
        atLabel: formatDateTime(entry.createdAt),
        icon: MessageSquare,
        title: 'נוספה הערה להזמנה',
        description: entry.content,
        actor: entry.user?.name ?? null,
      });
    }

    if (order.scheduledAt) {
      items.push({
        id: `schedule-${order.scheduledAt}`,
        kind: 'schedule',
        at: toTimestamp(order.scheduledAt),
        atLabel: formatDateTime(order.scheduledAt),
        icon: CalendarClock,
        title: 'מועד אספקה נקבע',
        description: order.notesToCrew?.trim() || 'תיאום האספקה נשמר במערכת.',
        actor: null,
      });
    }

    return items.sort((left, right) => right.at - left.at);
  }, [order.noteEntries, order.notesToCrew, order.scheduledAt, order.statusHistory]);

  return (
    <section className="space-y-4 rounded-[20px] border border-[#dbe5f5] bg-white p-4 shadow-[0_24px_56px_-36px_rgba(15,23,42,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-[#0f172a]">מעקב ביצוע</h2>
          <p className="text-xs font-medium text-[#6b7c93]">
            תמונת מצב עדכנית של ההזמנה והפעולות שכבר נשמרו במערכת.
          </p>
        </div>
        <EntityBadge label={`${activityItems.length} אירועים`} tone="neutral" size="md" />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <SummaryPill
          icon={PackageCheck}
          title="פריטים מוכנים"
          value={`${itemMetrics.ready}/${itemMetrics.total || 0}`}
          tone="success"
        />
        <SummaryPill
          icon={ShoppingCart}
          title="ממתינים למלאי"
          value={String(itemMetrics.waiting)}
          tone="warning"
        />
        <SummaryPill
          icon={CalendarClock}
          title="תיאום אספקה"
          value={
            order.scheduledAt
              ? formatOpsSchedule(order.scheduledAt, order.timeWindowStart, order.timeWindowEnd)
              : 'טרם נקבע'
          }
          tone={order.scheduledAt ? 'info' : 'neutral'}
        />
      </div>

      {itemMetrics.pending > 0 ? (
        <div className="rounded-[16px] border border-[#dbe5f5] bg-[#f8fbff] px-3 py-2 text-xs font-semibold text-[#5f7493]">
          יש עוד {itemMetrics.pending} פריטים ללא החלטת מלאי סופית.
        </div>
      ) : null}

      <div className="space-y-2">
        {activityItems.length ? (
          activityItems.map((item) => (
            <article
              key={item.id}
              className="rounded-[18px] border border-[#e2e8f0] bg-[#fbfdff] px-3 py-3"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                    item.kind === 'status' && 'bg-primary-50 text-primary-600',
                    item.kind === 'note' && 'bg-[#fff7ea] text-[#d45f00]',
                    item.kind === 'schedule' && 'bg-[#ebfff2] text-[#008c39]'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-[#0f172a]">{item.title}</h3>
                    {'status' in item ? (
                      <EntityBadge
                        label={getOrderStatusDisplay(item.status).label}
                        tone={getOrderStatusDisplay(item.status).tone}
                        dotClassName={getEntityToneDotClass(getOrderStatusDisplay(item.status).tone)}
                      />
                    ) : null}
                  </div>

                  {item.description ? (
                    <p className="text-sm leading-6 text-[#475569]">{item.description}</p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#8a99ad]">
                    <span>{item.atLabel}</span>
                    {item.actor ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.actor}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[18px] border border-dashed border-[#dbe5f5] bg-[#f8fbff] px-4 py-5 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#8fa2bf]">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <p className="text-sm font-bold text-[#334155]">עדיין לא נרשמו פעולות בהזמנה הזו</p>
            <p className="text-xs text-[#7c8da5]">
              ברגע שיתבצעו שינויי סטטוס, הערות או תיאום אספקה הם יופיעו כאן.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export const OrderActivityFeed = memo(OrderActivityFeedInner);
OrderActivityFeed.displayName = 'OrderActivityFeed';

function SummaryPill({
  icon: Icon,
  title,
  value,
  tone,
}: Readonly<{
  icon: LucideIcon;
  title: string;
  value: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
}>) {
  return (
    <EntityField
      icon={Icon}
      label={title}
      value={value}
      tone={tone === 'warning' ? 'warning' : tone === 'neutral' ? 'neutral' : 'info'}
    />
  );
}
