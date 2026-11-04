'use client';

import { EntityActionButton } from '@/components/shared/display/EntityPrimitives';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { OrderItemsSummaryCard } from '@/components/shared/OrderItemsSummaryCard';
import { useToast } from '@/components/ui/ToastProvider';
import apiClient from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { OperationalMessageKind } from '@prisma/client';
import {
  Check,
  CheckSquare,
  Clock3,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Statuses where "mark all ready" makes sense
const MARK_READY_ELIGIBLE_STATUSES = new Set([
  'PENDING',
  'NEW',
  'INTAKE',
  'IN_PROGRESS',
  'WAITING',
  'בדרך',
  'ממתין',
]);

interface OrderCardDetailsProps {
  customerName: string | null;
  itemsSummary?: string | null;
  itemLabels: string[];
  contactHref: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  orderId: string;
  orderStatus?: string | null;
  onOpenOrder?: (id: string) => void;
  nextActionDetailedLabel: string | null;
  primaryActionLabel: string;
  itemCountLabel: string;
  isPriorityOrder: boolean;
  showQuickAdvance: boolean;
  isAdvancing: boolean;
  flashSuccess: boolean;
  advanceButtonTargetLabel: string;
  onAdvanceClick: (event: React.MouseEvent) => void;
}

export function OrderCardDetails({
  customerName,
  itemsSummary,
  itemLabels,
  contactHref,
  customerEmail,
  customerPhone,
  orderId,
  orderStatus,
  onOpenOrder,
  nextActionDetailedLabel,
  primaryActionLabel,
  itemCountLabel,
  isPriorityOrder,
  showQuickAdvance,
  isAdvancing,
  flashSuccess,
  advanceButtonTargetLabel,
  onAdvanceClick,
}: Readonly<OrderCardDetailsProps>) {
  const toast = useToast();
  const [confirmingReady, setConfirmingReady] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);

  const showMarkReady = orderStatus
    ? MARK_READY_ELIGIBLE_STATUSES.has(String(orderStatus).toUpperCase()) ||
      MARK_READY_ELIGIBLE_STATUSES.has(String(orderStatus))
    : false;

  const emailTrimmed = customerEmail?.trim() ?? '';
  const hasPhone = Boolean(customerPhone?.replace(/\s+/g, '').length);
  const displayCustomerName = customerName?.trim() || DISPLAY_TEXT.unknownCustomer;

  const handleMarkReady = async () => {
    setIsMarkingReady(true);
    try {
      const response = await apiClient(`/api/orders/${orderId}/items/allocation/batch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_ALL_ALLOCATED' }),
      });
      if (!response.ok) throw new Error('שגיאה בעדכון הסטטוס');
      toast.success('כל הפריטים סומנו כמוכנים');
      setConfirmingReady(false);
    } catch {
      toast.error('שגיאה בעדכון הסטטוס. נסה שוב.');
    } finally {
      setIsMarkingReady(false);
    }
  };

  const sendQuickScheduleEmail = async () => {
    if (!emailTrimmed) {
      toast.error('אין אימייל ללקוח בהזמנה');
      return;
    }
    const idem =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSendingMail(true);
    try {
      const res = await apiClient(`/api/orders/${orderId}/operational-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idem,
        },
        body: JSON.stringify({
          to: emailTrimmed,
          operationalKind: OperationalMessageKind.DELIVERY_SCHEDULE_COORDINATION,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          j?.error?.message || (typeof j?.detail === 'string' ? j.detail : 'שליחת מייל נכשלה');
        throw new Error(msg);
      }
      toast.success('נשלח מייל תיאום משלוח (תבנית)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'שגיאת שליחה');
    } finally {
      setSendingMail(false);
    }
  };

  const sendQuickCourierWhatsApp = async () => {
    if (!hasPhone) {
      toast.error('אין טלפון ללקוח בהזמנה');
      return;
    }
    const idem =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSendingWa(true);
    try {
      const res = await apiClient(`/api/orders/${orderId}/operational-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idem,
        },
        body: JSON.stringify({
          operationalKind: OperationalMessageKind.DELIVERY_COURIER_ETA,
          mode: 'db_text',
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          j?.error?.message || (typeof j?.detail === 'string' ? j.detail : 'שליחת וואטסאפ נכשלה');
        throw new Error(msg);
      }
      toast.success('נשלח עדכון בוואטסאפ (תבנית)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'שגיאת שליחה');
    } finally {
      setSendingWa(false);
    }
  };

  const contactBtnClass =
    'inline-flex min-h-[40px] flex-1 basis-[calc(50%-4px)] items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-on-dark shadow-md transition-all duration-200 hover:brightness-110 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:basis-0 sm:min-w-0';

  return (
    <div className="mt-3 border-t border-subtle pt-3" onClick={(event) => event.stopPropagation()}>
      <div className="mb-3 flex flex-wrap gap-2 rounded-[14px] border border-subtle bg-primary-50/80 p-2.5 shadow-sm ring-1 ring-primary-200/40">
        <div className="flex min-w-[140px] flex-1 items-start gap-2 rounded-lg bg-surface/90 px-2 py-1.5 shadow-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-fg-subtle">
              {DISPLAY_TEXT.nextAction}
            </div>
            <p className="text-[12px] font-bold text-fg">{primaryActionLabel}</p>
          </div>
        </div>
        <div className="flex min-w-[140px] flex-1 items-start gap-2 rounded-lg bg-surface/90 px-2 py-1.5 shadow-sm">
          <Clock3
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              isPriorityOrder ? 'text-[var(--color-warning-600)]' : 'text-fg-subtle'
            )}
          />
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-fg-subtle">
              {DISPLAY_TEXT.schedule}
            </div>
            <p className="text-[12px] font-bold text-fg-muted">
              {nextActionDetailedLabel ?? DISPLAY_TEXT.noSchedule}
            </p>
          </div>
        </div>
        <div className="flex min-w-[100px] flex-1 items-start gap-2 rounded-lg bg-surface/90 px-2 py-1.5 shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black uppercase tracking-wider text-fg-subtle">
              {DISPLAY_TEXT.items}
            </div>
            <p className="text-[12px] font-bold text-fg-muted">{itemCountLabel}</p>
          </div>
        </div>
      </div>

      {/* Customer + contact — operational first */}
      <section className="mb-3 rounded-[14px] border border-subtle bg-surface-muted/50 p-3 shadow-sm">
        <div className="flex items-center gap-2 border-b border-subtle/80 pb-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-on-dark shadow-sm">
            <User className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">לקוח</p>
            <p className="truncate text-[15px] font-bold text-fg">{displayCustomerName}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!emailTrimmed || sendingMail || sendingWa}
            onClick={(event) => {
              event.stopPropagation();
              void sendQuickScheduleEmail();
            }}
            title={
              emailTrimmed
                ? 'שליחת מייל תיאום משלוח מתבנית (Google Workspace)'
                : 'אין אימייל ללקוח'
            }
            className={cn(
              contactBtnClass,
              'bg-primary-600 hover:shadow-primary-600/25 motion-safe:animate-[subtle-glow_3s_ease-in-out_infinite]'
            )}
          >
            {sendingMail ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 shrink-0" />
            )}
            מייל
          </button>

          <button
            type="button"
            disabled={!hasPhone || sendingMail || sendingWa}
            onClick={(event) => {
              event.stopPropagation();
              void sendQuickCourierWhatsApp();
            }}
            title={
              hasPhone
                ? 'שליחת הודעת וואטסאפ — שליח בדרך (תבנית + Cloud API)'
                : 'אין טלפון ללקוח'
            }
            className={cn(contactBtnClass, 'bg-[var(--color-whatsapp)] hover:shadow-[0_8px_24px_-6px_var(--color-whatsapp)]')}
          >
            {sendingWa ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4 shrink-0" />
            )}
            וואטסאפ
          </button>

          {contactHref ? (
            <a
              href={contactHref}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                contactBtnClass,
                'bg-[var(--color-success-600)] hover:shadow-[0_8px_24px_-6px_var(--color-success-500)]'
              )}
            >
              <Phone className="h-4 w-4 shrink-0" />
              שיחה
            </a>
          ) : null}
        </div>
      </section>

      <OrderItemsSummaryCard summary={itemsSummary} items={itemLabels} />

      {showQuickAdvance ? (
        <div className="mt-4 flex justify-center px-1">
          <button
            type="button"
            disabled={isAdvancing}
            onClick={onAdvanceClick}
            className={cn(
              'flex w-[80%] max-w-md min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-on-dark shadow-lg transition-all duration-300',
              'motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]',
              flashSuccess
                ? 'bg-[var(--color-success-600)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success-400)_45%,transparent)] motion-safe:animate-[pulse_0.6s_ease-out_1]'
                : isAdvancing
                  ? 'cursor-wait bg-primary-500 opacity-90'
                  : 'bg-primary-600 shadow-primary-600/30 motion-safe:animate-[subtle-glow_2.5s_ease-in-out_infinite]'
            )}
            aria-label={`קדם שלב: ${advanceButtonTargetLabel}`}
          >
            {flashSuccess ? (
              <Check className="h-4 w-4 shrink-0 motion-safe:animate-[bounce_0.5s_ease-out_1]" />
            ) : (
              <Zap className={cn('h-4 w-4 shrink-0', isAdvancing && 'animate-pulse')} />
            )}
            {flashSuccess
              ? 'עודכן!'
              : isAdvancing
                ? 'מעדכן...'
                : `קדם שלב · ${advanceButtonTargetLabel}`}
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-subtle pt-3">
        <Link
          href={`/orders/${orderId}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border-2 border-primary-500 bg-primary-600 px-3.5 py-2 text-[12px] font-bold text-on-dark shadow-md transition-all hover:bg-primary-700 active:scale-[0.98]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          פתח הזמנה
        </Link>

        {onOpenOrder ? (
          <EntityActionButton
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenOrder(orderId);
            }}
            className="min-h-[38px] rounded-xl border border-subtle bg-surface px-3.5 py-2 text-[12px] font-bold shadow-sm transition-colors hover:bg-surface-muted"
          >
            תצוגה מהירה
          </EntityActionButton>
        ) : null}

        {showMarkReady && !confirmingReady ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmingReady(true);
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[var(--color-success-600)] px-3.5 py-2 text-[12px] font-bold text-on-dark shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            סמן כמוכן
          </button>
        ) : null}
      </div>

      {confirmingReady ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--color-success-500)_30%,transparent)] bg-[var(--color-success-50)] px-3 py-2.5"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="min-w-0 flex-1 text-[12px] font-bold text-[var(--color-success-900)]">
            לסמן את כל פריטי ההזמנה כמוכנים?
          </span>
          <button
            type="button"
            disabled={isMarkingReady}
            onClick={(event) => {
              event.stopPropagation();
              void handleMarkReady();
            }}
            className="rounded-lg bg-[var(--color-success-600)] px-3 py-1.5 text-[11px] font-bold text-on-dark transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isMarkingReady ? 'מעדכן...' : 'אישור'}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmingReady(false);
            }}
            className="rounded-lg border border-subtle bg-surface px-3 py-1.5 text-[11px] font-bold text-fg-muted hover:bg-surface-muted"
          >
            ביטול
          </button>
        </div>
      ) : null}
    </div>
  );
}
