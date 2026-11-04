'use client';

import { OrderOpsScheduleForm } from '@/components/orders/ops/OrderOpsSharedForms';
import {
  buildDeliveryAddress,
  buildScheduleAddressPayload,
  buildScheduleWindowPayload,
  buildWazeLink,
  deriveScheduleWindowValue,
  formatOpsSchedule,
  normalizePhoneForWhatsApp,
  toDateInputValue,
} from '@/components/orders/ops/workflow/utils';
import { OrderQuickOperationalEmailPresets } from '@/components/orders/ops/OrderQuickOperationalEmailPresets';
import { OrderSummaryCard } from '@/components/orders/shared/OrderSummaryCard';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ordersApi } from '@/lib/api/services';
import type { OrderWithRelations } from '@/lib/api/types';
import { orderQueryKeys } from '@/lib/hooks/api/orders/queryKeys';
import { useOrderQuery } from '@/lib/hooks/api/orders/useOrderQuery';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  Truck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type DeliveryModalTab = 'pickup' | 'delivery';

const PICKUP_CHECK_ID = 'delivery_collected';
const DELIVERY_CHECK_ID = 'delivery_delivered';

const PICKUP_STATUSES = new Set([
  'READY',
  'READY_FOR_INSTALL',
  'INSTALL_SCHEDULING',
  'AWAITING_INSTALL',
  'SCHEDULED',
]);
const DELIVERY_ACTIVE_STATUSES = new Set(['IN_TRANSIT', 'INSTALLATION']);
const DELIVERY_DONE_STATUSES = new Set(['SUPPLIED', 'COMPLETED', 'INSTALLED', 'INVOICED']);

interface DeliveryOpsFloatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

function readChecklistFlag(order: OrderWithRelations | undefined, key: string): boolean {
  if (
    !order?.checklistState ||
    typeof order.checklistState !== 'object' ||
    Array.isArray(order.checklistState)
  ) {
    return false;
  }

  return Boolean((order.checklistState as Record<string, unknown>)[key]);
}

export default function DeliveryOpsFloatingModal({
  open,
  onOpenChange,
  orderId,
}: Readonly<DeliveryOpsFloatingModalProps>) {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useOrderQuery(orderId ?? '', {
    enabled: open && Boolean(orderId),
    refetchOnWindowFocus: false,
  });
  const order = data as OrderWithRelations | undefined;
  const [activeTab, setActiveTab] = useState<DeliveryModalTab>('pickup');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduleWindow, setScheduleWindow] = useState('09:00-12:00');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [pickupDraftChecked, setPickupDraftChecked] = useState(false);
  const [deliveryDraftChecked, setDeliveryDraftChecked] = useState(false);
  const [rebalanceNotice, setRebalanceNotice] = useState<string | null>(null);

  const pickupChecked = pickupDraftChecked;
  const deliveryChecked = deliveryDraftChecked;
  const customerPhone = order?.customer?.phone ?? order?.customerPhone ?? null;
  const whatsappPhone = normalizePhoneForWhatsApp(customerPhone);
  const address = useMemo(() => (order ? buildDeliveryAddress(order) : 'ללא כתובת מלאה'), [order]);
  const wazeHref = useMemo(() => (order ? buildWazeLink(order) : '#'), [order]);

  const effectiveTab: DeliveryModalTab =
    order?.status && DELIVERY_ACTIVE_STATUSES.has(String(order.status)) ? 'delivery' : activeTab;
  const isCompleted = order?.status ? DELIVERY_DONE_STATUSES.has(String(order.status)) : false;
  const canStartDelivery = order?.status ? PICKUP_STATUSES.has(String(order.status)) : false;
  const canCompleteDelivery = order?.status
    ? DELIVERY_ACTIVE_STATUSES.has(String(order.status))
    : false;

  useEffect(() => {
    if (!order) return;
    setScheduledDate(order.scheduledAt ? toDateInputValue(new Date(order.scheduledAt)) : '');
    setScheduleWindow(deriveScheduleWindowValue(order.timeWindowStart, order.timeWindowEnd));
    setScheduleNotes(order.notesToCrew ?? '');
    setIsEditingSchedule(false);
    setRebalanceNotice(null);
    setPickupDraftChecked(readChecklistFlag(order, PICKUP_CHECK_ID));
    setDeliveryDraftChecked(readChecklistFlag(order, DELIVERY_CHECK_ID));
  }, [order]);

  useEffect(() => {
    if (!open) {
      setIsEditingSchedule(false);
      setRebalanceNotice(null);
    }
  }, [open]);

  const syncQueries = async () => {
    if (!orderId) return;
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) }),
    ]);
  };

  const toggleChecklist = async (key: string, checked: boolean) => {
    if (!orderId) return;
    if (key === PICKUP_CHECK_ID) {
      setPickupDraftChecked(checked);
    }
    if (key === DELIVERY_CHECK_ID) {
      setDeliveryDraftChecked(checked);
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: key, isChecked: checked }),
      });

      if (!response.ok) {
        throw new Error('Failed to update checklist');
      }

      await syncQueries();
    } catch {
      if (key === PICKUP_CHECK_ID) {
        setPickupDraftChecked(readChecklistFlag(order, PICKUP_CHECK_ID));
      }
      if (key === DELIVERY_CHECK_ID) {
        setDeliveryDraftChecked(readChecklistFlag(order, DELIVERY_CHECK_ID));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const moveStatus = async (status: 'IN_TRANSIT' | 'COMPLETED', reason: string) => {
    if (!orderId) return;
    setIsProcessing(true);
    try {
      const result = await ordersApi.changeStatus(orderId, status, reason);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to update delivery');
      }
      await syncQueries();
      if (status === 'IN_TRANSIT') {
        setActiveTab('delivery');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const saveSchedule = async () => {
    const schedulePayload = buildScheduleWindowPayload(scheduledDate, scheduleWindow);
    if (!orderId || !order || !scheduledDate || !schedulePayload) return;
    setIsProcessing(true);
    try {
      const address = buildScheduleAddressPayload(order);

      const response = await fetch(`/api/orders/${orderId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: schedulePayload.scheduledAtIso,
          scheduledEnd: schedulePayload.scheduledEndIso,
          scheduleMode: 'TIME_WINDOW',
          timeWindowStart: schedulePayload.timeWindowStart,
          timeWindowEnd: schedulePayload.timeWindowEnd,
          expectedUpdatedAt: order.updatedAt,
          notesToCrew: scheduleNotes || undefined,
          status: 'SCHEDULED',
          address,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.detail?.message ||
            payload?.error?.message ||
            payload?.error ||
            payload?.message ||
            'Failed to schedule order'
        );
      }

      const result = await response.json().catch(() => null);
      await syncQueries();
      setIsEditingSchedule(false);

      if (result?.data?.autoRebalanced?.count) {
        setRebalanceNotice(
          `${result.data.autoRebalanced.count} משלוחים רחוקים יותר הועברו אוטומטית ליום הבא כדי לקצר את המסלול.`
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-[28px] bg-[#f4f7fb] p-0 shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[94vh] sm:max-h-[94vh] sm:w-[96vw] sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:border sm:border-white/60 sm:bg-white/72 sm:backdrop-blur-2xl sm:backdrop-saturate-[1.8] sm:shadow-[0_28px_80px_-30px_rgba(15,23,42,0.28)]"
        dir="rtl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>ניהול משלוח</DialogTitle>
          <DialogDescription>איסוף ומסירה מתוך לוח המשלוחים.</DialogDescription>
        </DialogHeader>

        {!orderId || isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : !order ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-semibold text-slate-600">לא ניתן לטעון את פרטי המשלוח.</p>
            <Button variant="outline" onClick={() => void refetch()}>
              נסה שוב
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-5">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black tracking-[0.16em] text-[#8fa2bf]">משלוח</div>
                  <div className="text-lg font-black text-[#0f172a]">{order.number}</div>
                </div>
                <div className="text-xs font-semibold text-[#7b8ca8]">
                  {isFetching
                    ? 'מרענן...'
                    : `מתוזמן ל-${formatOpsSchedule(
                        order.scheduledAt,
                        order.timeWindowStart,
                        order.timeWindowEnd
                      )}`}
                </div>
              </div>

              {rebalanceNotice ? (
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                  {rebalanceNotice}
                </div>
              ) : null}

              <OrderSummaryCard order={order} itemsCount={order.items?.length ?? 0} />

              <div className="rounded-[18px] border border-white/60 bg-white/60 p-3 backdrop-blur-md">
                <OrderQuickOperationalEmailPresets
                  orderId={order.id}
                  variant="deliveries"
                  onSent={() => void refetch()}
                />
              </div>

              <div className="flex gap-1 rounded-[18px] border border-white/60 bg-white/70 p-1.5 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setActiveTab('pickup')}
                  className={cn(
                    'flex flex-1 flex-col items-center rounded-[14px] px-3 py-2 text-sm font-black transition-colors',
                    effectiveTab === 'pickup'
                      ? 'bg-white/60 text-primary-600 backdrop-blur-sm'
                      : 'text-[#64748b] hover:bg-white/40'
                  )}
                >
                  <span>איסוף</span>
                  {isCompleted || pickupChecked ? (
                    <span className="mt-0.5 text-[9px] font-bold text-[#008c39]">✓ נאסף</span>
                  ) : canStartDelivery ? (
                    <span className="mt-0.5 text-[9px] font-bold text-[#d45f00]">ממתין לאיסוף</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('delivery')}
                  className={cn(
                    'flex flex-1 flex-col items-center rounded-[14px] px-3 py-2 text-sm font-black transition-colors',
                    effectiveTab === 'delivery'
                      ? 'bg-white/60 text-primary-600 backdrop-blur-sm'
                      : 'text-[#64748b] hover:bg-white/40'
                  )}
                >
                  <span>מסירה</span>
                  {isCompleted ? (
                    <span className="mt-0.5 text-[9px] font-bold text-[#008c39]">✓ הושלם</span>
                  ) : canCompleteDelivery ? (
                    <span className="mt-0.5 text-[9px] font-bold text-[#d45f00]">בדרך ללקוח</span>
                  ) : null}
                </button>
              </div>

              {effectiveTab === 'pickup' ? (
                <section className="space-y-4 rounded-[22px] border border-white/60 bg-white/70 p-4 backdrop-blur-md">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white/60 p-3 text-primary-500 backdrop-blur-sm">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-[#0f172a]">איסוף ההזמנה</h2>
                      <p className="text-sm font-medium text-[#64748b]">
                        {!order.scheduledAt
                          ? 'יש לתאם אספקה מול הלקוח'
                          : 'אשר שההזמנה נאספה מהמחסן ומוכנה ליציאה ללקוח.'}
                      </p>
                    </div>
                  </div>

                  {!order.scheduledAt || isEditingSchedule ? (
                    <OrderOpsScheduleForm
                      orderId={orderId}
                      scheduledDate={scheduledDate}
                      setScheduledDate={setScheduledDate}
                      scheduleWindow={scheduleWindow}
                      setScheduleWindow={setScheduleWindow}
                      notes={scheduleNotes}
                      setNotes={setScheduleNotes}
                      existingSchedule={order.scheduledAt ?? null}
                      existingTimeWindowStart={order.timeWindowStart ?? null}
                      existingTimeWindowEnd={order.timeWindowEnd ?? null}
                      customerPhone={customerPhone}
                      whatsappPhone={whatsappPhone}
                      onSubmit={saveSchedule}
                      isProcessing={isProcessing}
                    />
                  ) : (
                    <>
                      <div className="rounded-[18px] border border-white/60 bg-white/50 px-4 py-3 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-[#58708f]">מועד מתואם</div>
                            <div className="text-sm font-bold text-[#0f172a]">
                              {formatOpsSchedule(
                                order.scheduledAt,
                                order.timeWindowStart,
                                order.timeWindowEnd
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-[14px] border-white/60 text-primary-600 hover:bg-white/60"
                            onClick={() => setIsEditingSchedule(true)}
                            disabled={isProcessing || isCompleted}
                          >
                            שנה מועד
                          </Button>
                        </div>
                      </div>

                      <label className="flex items-center justify-between rounded-[18px] border border-white/60 bg-white/50 px-4 py-3 backdrop-blur-md">
                        <span className="text-sm font-bold text-[#0f172a]">
                          ההזמנה נאספה והועמסה
                        </span>
                        <input
                          type="checkbox"
                          checked={pickupChecked}
                          disabled={isProcessing || isCompleted}
                          onChange={(event) =>
                            void toggleChecklist(PICKUP_CHECK_ID, event.target.checked)
                          }
                          className="h-5 w-5 accent-primary-500"
                        />
                      </label>

                      <Button
                        type="button"
                        className="h-12 w-full rounded-[18px] bg-primary-500 text-on-dark hover:bg-primary-600"
                        disabled={
                          isProcessing || isCompleted || !pickupChecked || !canStartDelivery
                        }
                        onClick={() => void moveStatus('IN_TRANSIT', 'המשלוח נאסף ויצא ללקוח')}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Truck className="h-4 w-4" />
                        )}
                        אשר איסוף ויציאה ללקוח
                      </Button>
                    </>
                  )}
                </section>
              ) : (
                <section className="space-y-4 rounded-[22px] border border-white/60 bg-white/70 p-4 backdrop-blur-md">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <a
                      href={wazeHref}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] border border-white/60 bg-white/60 px-4 py-3 text-sm font-black text-primary-600 backdrop-blur-sm"
                    >
                      <Navigation className="h-4 w-4" />
                      פתח Waze
                    </a>
                    {customerPhone ? (
                      <a
                        href={`tel:${customerPhone}`}
                        className="flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] border border-white/60 bg-white/70 px-4 py-3 text-sm font-black text-[#334155] backdrop-blur-sm"
                      >
                        <Phone className="h-4 w-4 text-primary-600" />
                        חייג ללקוח
                      </a>
                    ) : (
                      <div className="flex min-h-[54px] items-center justify-center rounded-[18px] border border-dashed border-white/60 bg-white/40 px-4 py-3 text-sm font-bold text-[#94a3b8] backdrop-blur-sm">
                        אין מספר טלפון
                      </div>
                    )}
                    {whatsappPhone ? (
                      <a
                        href={`https://wa.me/${whatsappPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] border border-white/60 bg-white/60 px-4 py-3 text-sm font-black text-[#008c39] backdrop-blur-sm"
                      >
                        <MessageCircle className="h-4 w-4" />
                        וואטסאפ
                      </a>
                    ) : (
                      <div className="flex min-h-[54px] items-center justify-center rounded-[18px] border border-dashed border-white/60 bg-white/40 px-4 py-3 text-sm font-bold text-[#94a3b8] backdrop-blur-sm">
                        אין וואטסאפ
                      </div>
                    )}
                  </div>

                  <div className="rounded-[18px] border border-white/60 bg-white/50 px-4 py-3 backdrop-blur-md">
                    <div className="mb-1 flex items-center gap-2 text-sm font-black text-[#0f172a]">
                      <MapPin className="h-4 w-4 text-primary-500" />
                      כתובת למסירה
                    </div>
                    <div className="text-sm font-semibold text-[#58708f]">{address}</div>
                  </div>

                  <label className="flex items-center justify-between rounded-[18px] border border-white/60 bg-white/50 px-4 py-3 backdrop-blur-md">
                    <span className="text-sm font-bold text-[#0f172a]">המשלוח נמסר ללקוח</span>
                    <input
                      type="checkbox"
                      checked={deliveryChecked}
                      disabled={isProcessing || isCompleted}
                      onChange={(event) =>
                        void toggleChecklist(DELIVERY_CHECK_ID, event.target.checked)
                      }
                      className="h-5 w-5 accent-primary-500"
                    />
                  </label>

                  <Button
                    type="button"
                    className="h-12 w-full rounded-[18px] bg-[#00a63e] text-on-dark hover:bg-[#008c39]"
                    disabled={
                      isProcessing || isCompleted || !deliveryChecked || !canCompleteDelivery
                    }
                    onClick={() => void moveStatus('COMPLETED', 'המשלוח נמסר ללקוח והושלם')}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    אשר מסירה וסיים משלוח
                  </Button>
                </section>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
