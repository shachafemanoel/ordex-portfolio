import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

import {
  EntityBadge,
  EntityNotice,
  type EntityTone,
} from '@/components/shared/display/EntityPrimitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { useRBAC } from '@/hooks/useRBAC';
import { isNotFoundOrdersError, isOrdersApiError } from '@/lib/hooks/api/orders/errors';
import { cn } from '@/lib/utils';

import {
  OrderOpsItemsSummary,
  OrderOpsReadyForm,
  OrderOpsScheduleConfirmed,
  OrderOpsScheduleForm,
} from './OrderOpsSharedForms';
import type { OrderOpsForm } from './formTypes';
import OpsHeader from './workflow/OpsHeader';
import type { OrderOpsData } from './workflow/types';
import { useOpsWorkflow } from './workflow/useOpsWorkflow';
import { normalizePhoneForWhatsApp } from './workflow/utils';

// Extracted Components
import { OrderOverviewCard } from './components/OrderOverviewCard';
import { OrderActionsPanel } from './components/OrderActionsPanel';
import { OrderStatusBar } from './OrderStatusBar';

interface OrderOpsFloatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  initialOrder?: Partial<OrderOpsData> | null;
  initialForm?: OrderOpsForm | null;
}

function OrderOpsTabBadge({
  label,
  tone,
}: Readonly<{
  label: string;
  tone: EntityTone;
}>) {
  return <EntityBadge label={label} tone={tone} size="sm" className="mt-1 text-[9px]" />;
}

export default function OrderOpsFloatingModal({
  open,
  onOpenChange,
  orderId,
  initialOrder,
  initialForm,
}: OrderOpsFloatingModalProps) {
  if (!orderId) return null;

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-[100vw] max-w-none flex-col overflow-hidden rounded-none border-none bg-surface p-0 sm:h-[95vh] sm:max-h-[95vh] sm:w-[98vw] sm:rounded-[28px] sm:border sm:border-subtle sm:bg-surface-muted shadow-2xl md:max-w-5xl"
        dir="rtl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>ניהול הזמנה {orderId}</DialogTitle>
          <DialogDescription>פרטי הזמנה ופעולות ניהול.</DialogDescription>
        </DialogHeader>

        <ModalContent
          orderId={orderId}
          initialOrder={initialOrder}
          initialForm={initialForm}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ModalContent({
  orderId,
  initialOrder,
  initialForm,
  onClose,
}: {
  orderId: string;
  initialOrder?: Partial<OrderOpsData> | null;
  initialForm?: OrderOpsForm | null;
  onClose: () => void;
}) {
  const {
    orderData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    activeTab,
    setActiveTab,
    isProcessing,
    intakeDecisions,
    setIntakeDecisions,
    saveIntake,
    changeOrderStatus,

    // Schedule form state
    scheduledDate,
    setScheduledDate,
    scheduleWindow,
    setScheduleWindow,
    scheduleNotes,
    setScheduleNotes,
    saveSchedule,

    items,
    isIntakeLocked,
    isScheduleLocked,
    isOrderCompleted,
    workflowFocus,
  } = useOpsWorkflow({ orderId, initialOrder });
  const { isAdmin } = useRBAC();
  const visibleTab = activeTab === 'schedule' ? 'schedule' : activeTab === 'actions' ? 'actions' : 'ready';
  const currentPrimaryTab = visibleTab === 'ready' ? 'intake' : visibleTab;
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [showAdditionalTabs, setShowAdditionalTabs] = useState(false);

  // Tab badge data — reflects both server state AND local intake decisions for optimistic UI
  const pendingItemsCount = items.filter((i) => {
    const localDecision = intakeDecisions[i.id];
    if (localDecision === 'STOCK') return false; // locally marked as ready
    if (localDecision === 'PO') return false; // locally marked as PO (shows as on-order)
    return i.allocationStatus === 'PENDING';
  }).length;
  const onOrderItemsCount = items.filter((i) => {
    const localDecision = intakeDecisions[i.id];
    if (localDecision === 'PO') return true; // locally marked as waiting for supplier
    if (localDecision === 'STOCK') return false;
    return i.allocationStatus === 'ON_ORDER';
  }).length;
  const allItemsReady =
    items.length > 0 &&
    items.every((i) => {
      const localDecision = intakeDecisions[i.id];
      if (localDecision === 'STOCK') return true;
      if (localDecision === 'PO') return false;
      return i.allocationStatus === 'ALLOCATED' || i.allocationStatus === 'OUT_OF_STOCK';
    });
  const hasSchedule = Boolean(orderData?.scheduledAt);

  // Determine whether to show read-only schedule view or editable form
  const showScheduleForm = !isScheduleLocked && (!hasSchedule || editingSchedule);

  useEffect(() => {
    setShowAdditionalTabs(false);
    if (initialForm === 'schedule') {
      setActiveTab('schedule');
      return;
    }

    if (initialForm === 'ready' || initialForm === 'purchase' || initialForm === 'issue') {
      setActiveTab('intake');
    }
  }, [initialForm, orderId, setActiveTab]);

  const tabOptions = useMemo(
    () => [
      {
        key: 'intake' as const,
        label: 'פרטי הזמנה',
        badge:
          isIntakeLocked
            ? { label: 'הושלם', tone: 'success' as EntityTone }
            : items.length > 0
              ? allItemsReady
                ? { label: 'מוכנים', tone: 'success' as EntityTone }
                : onOrderItemsCount > 0
                  ? { label: `${onOrderItemsCount} בהזמנה`, tone: 'info' as EntityTone }
                  : pendingItemsCount > 0
                    ? { label: `${pendingItemsCount} ממתינים`, tone: 'warning' as EntityTone }
                    : null
              : null,
      },
      {
        key: 'schedule' as const,
        label: 'משלוח',
        badge: isOrderCompleted
          ? { label: 'הושלם', tone: 'success' as EntityTone }
          : hasSchedule
            ? { label: 'תואם', tone: 'success' as EntityTone }
            : allItemsReady
              ? { label: 'מוכן לתיאום', tone: 'info' as EntityTone }
              : { label: 'טרם תואם', tone: 'neutral' as EntityTone },
      },
      {
        key: 'actions' as const,
        label: 'אפשרויות ניהול',
        badge: { label: 'כלים ופעולות', tone: 'warning' as EntityTone },
      },
    ],
    [allItemsReady, hasSchedule, isIntakeLocked, isOrderCompleted, items.length, onOrderItemsCount, pendingItemsCount]
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-20">
        <Loader2 className="animate-spin text-brand" size={40} />
      </div>
    );
  }

  if (isError && !orderData) {
    const isNotFound = isNotFoundOrdersError(error);
    const message = isOrdersApiError(error) ? error.message : 'שגיאה בטעינת ההזמנה';
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="text-fg-muted">{isNotFound ? 'הזמנה לא נמצאה' : message}</p>
        <div className="flex items-center gap-2">
          {!isNotFound ? (
            <Button variant="outline" onClick={() => void refetch()}>
              נסה שוב
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            סגור
          </Button>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center text-fg-muted">
        <p>לא התקבלו נתוני הזמנה.</p>
        <Button variant="outline" onClick={() => void refetch()}>
          רענן נתונים
        </Button>
      </div>
    );
  }

  const customerPhone = orderData.customer?.phone ?? orderData.customerPhone ?? null;
  const whatsappPhone = normalizePhoneForWhatsApp(customerPhone);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface" dir="rtl">
      {isError ? (
        <EntityNotice
          title="החיבור לשרת נכשל זמנית"
          description="מוצגים כרגע הנתונים האחרונים שנשמרו."
          tone="warning"
          className="mx-4 mt-3 rounded-[14px]"
        />
      ) : null}

      <OpsHeader
        orderData={orderData}
        isFetching={isFetching}
        onClose={onClose}
        orderId={orderId}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200 sm:p-5 sm:pb-8 md:p-6 md:pb-10">
        <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-8">
          <OrderOverviewCard orderData={orderData} items={items} />

          <OrderStatusBar order={orderData} canOverride={isAdmin} onChangeStatus={changeOrderStatus} />

          <div className="rounded-[22px] border border-subtle bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-primary-50)_100%)] p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <EntityBadge
                    label={workflowFocus.source === 'server' ? 'פעולה נדרשת עכשיו' : 'השלב הבא'}
                    tone={workflowFocus.source === 'server' ? 'info' : 'neutral'}
                    size="sm"
                  />
                  <OrderOpsTabBadge
                    label={tabOptions.find((tab) => tab.key === currentPrimaryTab)?.label ?? workflowFocus.primaryLabel}
                    tone={currentPrimaryTab === 'actions' ? 'warning' : currentPrimaryTab === 'schedule' ? 'info' : 'neutral'}
                  />
                </div>
                <div className="mt-3 text-base font-black text-fg">{workflowFocus.title}</div>
                <div className="mt-1 text-sm font-medium leading-6 text-fg-muted">{workflowFocus.description}</div>
              </div>
              <EntityBadge label={workflowFocus.primaryLabel} tone="accent" size="md" className="shrink-0" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-subtle pt-3">
              <div className="text-[11px] font-bold text-fg-muted">
                {showAdditionalTabs ? 'אפשר לעבור ידנית בין אזורים נוספים' : 'מוצג רק אזור העבודה הרלוונטי'}
              </div>
              <button
                type="button"
                onClick={() => setShowAdditionalTabs((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full border border-subtle bg-surface px-3 py-1.5 text-[11px] font-black text-fg-muted transition hover:bg-surface-muted"
              >
                <span>{showAdditionalTabs ? 'הסתר אזורים נוספים' : 'הצג אזורים נוספים'}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAdditionalTabs && 'rotate-180')} />
              </button>
            </div>

            {showAdditionalTabs ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {tabOptions.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'rounded-full border px-3 py-2 text-right transition',
                      currentPrimaryTab === tab.key
                        ? 'border-subtle bg-surface text-fg shadow-sm'
                        : 'border-subtle bg-surface-muted text-fg-muted hover:bg-surface'
                    )}
                  >
                    <div className="text-[11px] font-black">{tab.label}</div>
                    {tab.badge ? <OrderOpsTabBadge label={tab.badge.label} tone={tab.badge.tone} /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="animate-in slide-in-from-bottom-2 duration-300">
            {visibleTab === 'ready' ? (
              isIntakeLocked ? (
                <OrderOpsItemsSummary items={items} />
              ) : (
                <OrderOpsReadyForm
                  items={items}
                  decisions={intakeDecisions}
                  setDecisions={setIntakeDecisions}
                  onSubmit={async () => {
                    await saveIntake();
                  }}
                  isProcessing={isProcessing}
                />
              )
            ) : visibleTab === 'schedule' ? (
              showScheduleForm ? (
                <OrderOpsScheduleForm
                  orderId={orderId}
                  scheduledDate={scheduledDate}
                  setScheduledDate={setScheduledDate}
                  scheduleWindow={scheduleWindow}
                  setScheduleWindow={setScheduleWindow}
                  notes={scheduleNotes}
                  setNotes={setScheduleNotes}
                  existingSchedule={orderData.scheduledAt ?? null}
                  existingTimeWindowStart={orderData.timeWindowStart ?? null}
                  existingTimeWindowEnd={orderData.timeWindowEnd ?? null}
                  customerPhone={customerPhone}
                  whatsappPhone={whatsappPhone}
                  onSubmit={async () => {
                    await saveSchedule();
                    setEditingSchedule(false);
                  }}
                  isProcessing={isProcessing}
                />
              ) : (
                <OrderOpsScheduleConfirmed
                  scheduledAt={orderData.scheduledAt!}
                  timeWindowStart={orderData.timeWindowStart ?? null}
                  timeWindowEnd={orderData.timeWindowEnd ?? null}
                  notes={orderData.notesToCrew ?? null}
                  isCompleted={isOrderCompleted}
                  onEdit={isScheduleLocked ? undefined : () => setEditingSchedule(true)}
                />
              )
            ) : (
              <OrderActionsPanel
                orderId={orderId}
                orderNumber={orderData.number}
                items={items}
                initialAction={workflowFocus.actionPanel}
                onSuccess={async () => {
                  await refetch();
                  onClose();
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
