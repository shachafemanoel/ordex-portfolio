'use client';

import dynamic from 'next/dynamic';
import {
  OrderOpsReadyForm,
  OrderOpsScheduleForm,
} from '@/components/orders/ops/OrderOpsSharedForms';
import { OrderActionsPanel } from '@/components/orders/ops/components/OrderActionsPanel';
import { OrderStatusBar } from '@/components/orders/ops/OrderStatusBar';
import { OrderSummaryCard } from '@/components/orders/shared/OrderSummaryCard';
import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { getEntityToneDotClass, getOrderStatusDisplay } from '@/components/shared/display/displayStatus';
import type { OrderWithRelations } from '@/lib/api/types';
import { useRBAC } from '@/hooks/useRBAC';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { useOpsWorkflow } from './ops/workflow/useOpsWorkflow';
import {
  formatOpsDateTime,
  normalizePhoneForWhatsApp,
} from './ops/workflow/utils';

export interface MobileOrderDetailProps {
  order: OrderWithRelations;
}

type DetailTab = 'ready' | 'schedule' | 'actions';

const LazyOrderActivityFeed = dynamic(
  () =>
    import('@/components/orders/shared/OrderActivityFeed').then((module) => module.OrderActivityFeed),
  {
    ssr: false,
    loading: () => (
      <section className="rounded-[20px] border border-[#dbe5f5] bg-white p-4 shadow-[0_24px_56px_-36px_rgba(15,23,42,0.18)]">
        <div className="h-5 w-28 animate-pulse rounded-full bg-primary-50" />
        <div className="mt-4 space-y-2">
          <div className="h-16 animate-pulse rounded-[18px] bg-[#f8fbff]" />
          <div className="h-16 animate-pulse rounded-[18px] bg-[#f8fbff]" />
        </div>
      </section>
    ),
  }
);

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function MobileOrderDetail({ order }: Readonly<MobileOrderDetailProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { direction } = useUITranslation();
  const { isAdmin } = useRBAC();

  // Determine breadcrumb context from URL params or default to orders list
  const fromParam = searchParams.get('from');
  const fromLabel = fromParam === 'customers'
    ? searchParams.get('customerName') ?? 'לקוחות'
    : 'ניהול הזמנות';
  const fromHref = fromParam === 'customers' && searchParams.get('customerId')
    ? `/customers/${searchParams.get('customerId')}`
    : '/orders';

  const {
    orderData: liveOrder,
    activeTab,
    setActiveTab,
    isProcessing,
    intakeDecisions,
    setIntakeDecisions,
    saveIntake,
    changeOrderStatus,
    scheduledDate,
    setScheduledDate,
    scheduleWindow,
    setScheduleWindow,
    scheduleNotes,
    setScheduleNotes,
    saveSchedule,
    items: opsItems,
    refetch,
  } = useOpsWorkflow({
    orderId: order.id,
    initialOrder: order,
  });
  const visibleTab: DetailTab = activeTab === 'schedule' ? 'schedule' : activeTab === 'actions' ? 'actions' : 'ready';

  const displayOrder = (liveOrder as OrderWithRelations | undefined) ?? order;
  const orderStatusDisplay = getOrderStatusDisplay(String(displayOrder.status));

  // Tab badge data — derived from live item/order state, auto-updates after each action
  const pendingItemsCount = opsItems.filter((i) => i.allocationStatus === 'PENDING').length;
  const onOrderItemsCount = opsItems.filter((i) => i.allocationStatus === 'ON_ORDER').length;
  const allItemsReady =
    opsItems.length > 0 &&
    opsItems.every((i) => i.allocationStatus === 'ALLOCATED' || i.allocationStatus === 'OUT_OF_STOCK');
  const hasSchedule = Boolean(displayOrder.scheduledAt);
  const customerPhoneRaw = displayOrder.customer?.phone || displayOrder.customerPhone || null;
  const whatsappPhone = normalizePhoneForWhatsApp(customerPhoneRaw);
  const paymentRows = useMemo(() => {
    const rows: Array<{ label: string; value: string; tone?: 'warning' }> = [];

    if (displayOrder.shipping > 0) {
      rows.push({ label: 'משלוח', value: formatCurrency(displayOrder.shipping) });
    }

    if (displayOrder.tax > 0) {
      rows.push({ label: 'מע״מ', value: formatCurrency(displayOrder.tax) });
    }

    if (displayOrder.paidAmount > 0) {
      rows.push({ label: 'שולם', value: formatCurrency(displayOrder.paidAmount) });
    }

    if (displayOrder.outstandingBalance > 0) {
      rows.push({
        label: 'יתרה לתשלום',
        value: formatCurrency(displayOrder.outstandingBalance),
        tone: 'warning',
      });
    }

    rows.unshift({ label: 'סה״כ הזמנה', value: formatCurrency(displayOrder.total) });
    return rows;
  }, [displayOrder.outstandingBalance, displayOrder.paidAmount, displayOrder.shipping, displayOrder.tax, displayOrder.total]);

  return (
    <div
      className="min-h-[100dvh] pb-24 overflow-x-hidden"
      dir={direction}
    >
      {/* Header with breadcrumb */}
      <header className="sticky top-0 z-30 px-responsive py-3 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        {/* Breadcrumb row */}
        <div className="flex items-center gap-1 text-[12px] text-slate-400 mb-1.5">
          <Link href="/orders" className="hover:text-slate-600 transition-colors font-medium">רצף</Link>
          <ChevronLeft className="h-3 w-3 shrink-0" />
          <Link href={fromHref} className="hover:text-slate-600 transition-colors font-medium">{fromLabel}</Link>
          <ChevronLeft className="h-3 w-3 shrink-0" />
          <span className="text-slate-600 font-bold truncate">
            {displayOrder.number ? `הזמנה #${displayOrder.number}` : `הזמנה ...${displayOrder.id.slice(-6)}`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-responsive-title">
            הזמנה #{displayOrder.number || displayOrder.id.slice(-6)}
          </h1>
          <Link
            href={fromHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowRight className="h-4 w-4" />
            {fromLabel}
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-responsive py-4 sm:py-6">
        <div className="lg:grid lg:grid-cols-[1fr,380px] lg:items-start lg:gap-8">
          {/* Main Column */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <EntityBadge
                  label={orderStatusDisplay.label}
                  tone={orderStatusDisplay.tone}
                  dotClassName={getEntityToneDotClass(orderStatusDisplay.tone)}
                  size="md"
                />
                <EntityBadge label={`נוצרה ${formatOpsDateTime(displayOrder.createdAt)}`} tone="neutral" size="md" />
              </div>
            </div>

            {displayOrder.addressOverridden && (
              <p role="status" className="rounded-lg border border-subtle bg-surface-muted p-3 text-sm text-fg" data-testid="woo-local-address">
                {displayOrder.sourceAddressDiffers ? 'הכתובת שונה מכתובת החנות. ' : ''}הכתובת נערכה ברצף ונשמרת מקומית; עדכוני חנות לא ידרסו אותה.
              </p>
            )}
            {displayOrder.sourceReviewReason && (
              <p role="alert" className="rounded-lg border border-subtle bg-surface-muted p-3 text-sm text-danger" data-testid="woo-source-review">
                עדכון מהחנות דורש בדיקת מנהל. יציאה רגילה חסומה עד לבירור.
              </p>
            )}
            <OrderStatusBar
              order={displayOrder}
              canOverride={isAdmin}
              onChangeStatus={changeOrderStatus}
            />

            {/* Mobile Only Summary */}
            <div className="lg:hidden">
              <OrderSummaryCard
                order={displayOrder}
                itemsCount={opsItems.length}
                className="border-slate-200 bg-white shadow-[0_8px_30px_-14px_rgba(15,23,42,0.12)]"
              />
            </div>

            <div className="flex gap-1.5 rounded-[22px] border border-slate-200 bg-slate-50 p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab('intake')}
                className={cn(
                  'flex flex-1 flex-col items-center rounded-[14px] px-2 py-2.5 text-sm transition-all duration-150',
                  visibleTab === 'ready'
                    ? 'bg-white font-black text-primary-600 shadow-[0_2px_12px_-4px_rgba(59,130,246,0.35)] border border-blue-100'
                    : 'font-medium text-slate-400 hover:text-slate-600 hover:bg-white/60'
                )}
              >
                <span>פרטי הזמנה</span>
                {opsItems.length > 0 ? (
                  allItemsReady ? (
                    <span className={cn('mt-0.5 text-[9px] font-bold', visibleTab === 'ready' ? 'text-[#008c39]' : 'text-slate-400')}>✓ מוכנים</span>
                  ) : onOrderItemsCount > 0 ? (
                    <span className={cn('mt-0.5 text-[9px] font-bold', visibleTab === 'ready' ? 'text-primary-600' : 'text-slate-400')}>{onOrderItemsCount} בהזמנה</span>
                  ) : pendingItemsCount > 0 ? (
                    <span className={cn('mt-0.5 text-[9px] font-bold', visibleTab === 'ready' ? 'text-[#d45f00]' : 'text-slate-400')}>{pendingItemsCount} ממתינים</span>
                  ) : null
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={cn(
                  'flex flex-1 flex-col items-center rounded-[14px] px-2 py-2.5 text-sm transition-all duration-150',
                  visibleTab === 'schedule'
                    ? 'bg-white font-black text-primary-600 shadow-[0_2px_12px_-4px_rgba(59,130,246,0.35)] border border-blue-100'
                    : 'font-medium text-slate-400 hover:text-slate-600 hover:bg-white/60'
                )}
              >
                <span>משלוח</span>
                {hasSchedule ? (
                  <span className={cn('mt-0.5 text-[9px] font-bold', visibleTab === 'schedule' ? 'text-[#008c39]' : 'text-slate-400')}>✓ תואם</span>
                ) : (
                  <span className="mt-0.5 text-[9px] font-bold text-slate-400">טרם תואם</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('actions')}
                className={cn(
                  'flex flex-1 flex-col items-center rounded-[14px] px-2 py-2.5 text-sm transition-all duration-150',
                  visibleTab === 'actions'
                    ? 'bg-white font-black text-[#d45f00] shadow-[0_2px_12px_-4px_rgba(249,115,22,0.35)] border border-orange-100'
                    : 'font-medium text-slate-400 hover:text-slate-600 hover:bg-white/60'
                )}
              >
                <span>אפשרויות ניהול</span>
              </button>
            </div>

            <div className="animate-in slide-in-from-bottom-2 duration-300">
              {visibleTab === 'ready' ? (
                <OrderOpsReadyForm
                  items={opsItems}
                  decisions={intakeDecisions}
                  setDecisions={setIntakeDecisions}
                  onSubmit={saveIntake}
                  isProcessing={isProcessing}
                />
              ) : visibleTab === 'schedule' ? (
                <>
                  <OrderOpsScheduleForm
                    orderId={order.id}
                    scheduledDate={scheduledDate}
                    setScheduledDate={setScheduledDate}
                    scheduleWindow={scheduleWindow}
                    setScheduleWindow={setScheduleWindow}
                    notes={scheduleNotes}
                    setNotes={setScheduleNotes}
                    existingSchedule={displayOrder.scheduledAt ?? null}
                    existingTimeWindowStart={displayOrder.timeWindowStart ?? null}
                    existingTimeWindowEnd={displayOrder.timeWindowEnd ?? null}
                    customerPhone={customerPhoneRaw}
                    whatsappPhone={whatsappPhone}
                    onSubmit={saveSchedule}
                    isProcessing={isProcessing}
                  />
                </>
              ) : (
                <OrderActionsPanel
                  orderId={order.id}
                  orderNumber={displayOrder.number}
                  items={opsItems}
                  onSuccess={() => void refetch()}
                />
              )}
            </div>

            <div style={{ contentVisibility: 'auto', containIntrinsicSize: '480px' }}>
              <LazyOrderActivityFeed order={displayOrder} />
            </div>

            {/* Mobile Only Payment Summary */}
            <div className="lg:hidden">
              {paymentRows.length ? (
                <PaymentSummarySection paymentRows={paymentRows} />
              ) : null}
            </div>
          </div>

          {/* Sidebar Column (Desktop Only) */}
          <aside className="sticky top-[100px] hidden space-y-6 lg:block">
            <OrderSummaryCard
              order={displayOrder}
              itemsCount={opsItems.length}
              className="border-slate-200 bg-white shadow-[0_12px_40px_-16px_rgba(15,23,42,0.12)]"
            />
            
            {paymentRows.length ? (
              <PaymentSummarySection paymentRows={paymentRows} />
            ) : null}

            <div className="rounded-[24px] border border-slate-200 bg-white/40 p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-black text-slate-900">מידע נוסף</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-500 font-medium">סוג הזמנה</span>
                  <span className="font-bold text-slate-800">{displayOrder.fulfillmentType === 'INSTALLATION' ? 'התקנה' : 'אספקה'}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-500 font-medium">משתמש מטפל</span>
                  <span className="font-bold text-slate-800">{displayOrder.assignedUser?.name || 'טרם נקבע'}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-500 font-medium">מקור הגעה</span>
                  <span className="font-bold text-slate-800">{displayOrder.channel === 'WOOCOMMERCE' ? 'WooCommerce' : 'ישיר'}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PaymentSummarySection({ paymentRows }: { paymentRows: Array<{ label: string; value: string; tone?: 'warning' }> }) {
  return (
    <section
      className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_-14px_rgba(15,23,42,0.1)]"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '220px' }}
    >
      <h2 className="text-responsive-heading">סיכום תשלום</h2>
      {paymentRows.map((row) => (
        <div
          key={row.label}
          className={cn(
            'flex items-center justify-between rounded-[16px] px-3 py-2.5 border border-transparent',
            row.tone === 'warning' ? 'bg-orange-50 text-orange-900 border-orange-100' : 'bg-slate-50 text-slate-900 border-slate-100'
          )}
        >
          <span className="text-sm font-bold opacity-70">{row.label}</span>
          <span className="text-sm font-black">{row.value}</span>
        </div>
      ))}
    </section>
  );
}
