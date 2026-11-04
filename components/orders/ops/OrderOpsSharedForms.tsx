'use client';

import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Phone,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { OpsFlowHero, OpsFlowNote, OpsFlowOption, OpsFlowPrimaryButton } from './OpsFlowPrimitives';
import { SmartSchedulePlanner } from './SmartSchedulePlanner';
import type { OpsItem, SupplierOption } from './workflow/types';
import {
  buildDateOnlyShortcut,
  formatOpsSchedule,
} from './workflow/utils';

export function OrderOpsBackButton({ onBack }: Readonly<{ onBack?: () => void }>) {
  if (!onBack) return null;

  return (
    <button
      type="button"
      onClick={onBack}
      className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
    >
      <ArrowRight className="h-4 w-4" />
      חזור לפעולות
    </button>
  );
}

interface OrderOpsReadyFormProps {
  items: OpsItem[];
  decisions: Record<string, 'STOCK' | 'PO'>;
  setDecisions: Dispatch<SetStateAction<Record<string, 'STOCK' | 'PO'>>>;
  onSubmit: () => Promise<void>;
  onBack?: () => void;
  isProcessing: boolean;
}

export function OrderOpsReadyForm({
  items,
  decisions,
  setDecisions,
  onSubmit,
  onBack,
  isProcessing,
}: Readonly<OrderOpsReadyFormProps>) {
  const decisionsCount = Object.keys(decisions).length;
  const stockCount = Object.values(decisions).filter((value) => value === 'STOCK').length;
  const waitingCount = Object.values(decisions).filter((value) => value === 'PO').length;
  const allSet = items.length > 0 && items.every((item) => Boolean(decisions[item.id]));

  return (
    <div className="space-y-4">
      <OrderOpsBackButton onBack={onBack} />

      <OpsFlowHero
        accent="primary"
        icon={Package}
        title="קביעת סטטוס פריטים"
        description="עבור כל פריט סמן אם הוא קיים במלאי או עדיין ממתין לאספקה."
        aside={
          <EntityBadge label={`${decisionsCount}/${items.length}`} tone="info" size="md" className="shadow-sm" />
        }
      />

      <div className="flex flex-wrap gap-2 text-[12px] font-bold">
        <EntityBadge label={`סומנו ${decisionsCount}`} tone="neutral" className="text-[12px] tracking-tight" />
        <EntityBadge label={`במלאי ${stockCount}`} tone="success" className="text-[12px] tracking-tight" />
        <EntityBadge label={`ממתינים ${waitingCount}`} tone="warning" className="text-[12px] tracking-tight" />
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <OpsFlowOption
            key={item.id}
            accent={decisions[item.id] === 'PO' ? 'warning' : 'primary'}
            icon={decisions[item.id] === 'PO' ? ShoppingCart : Package}
            title={item.name}
            description={`כמות: ${item.quantity}${item.sku ? ` • מק״ט ${item.sku}` : ''}`}
            active={Boolean(decisions[item.id])}
            trailing={
              <input
                type="checkbox"
                checked={Boolean(decisions[item.id])}
                readOnly
                className="h-5 w-5 rounded border-slate-300 text-primary-500 accent-primary-500"
              />
            }
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setDecisions((previous) => ({
                    ...previous,
                    [item.id]: 'STOCK',
                  }))
                }
                className={cn(
                  'rounded-full border px-3 py-2 text-xs font-black transition-colors shadow-sm',
                  decisions[item.id] === 'STOCK'
                    ? 'border-emerald-200 bg-emerald-50 text-[#008c39]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                מוכן
              </button>
              <button
                type="button"
                onClick={() =>
                  setDecisions((previous) => ({
                    ...previous,
                    [item.id]: 'PO',
                  }))
                }
                className={cn(
                  'rounded-full border px-3 py-2 text-xs font-black transition-colors shadow-sm',
                  decisions[item.id] === 'PO'
                    ? 'border-orange-200 bg-orange-50 text-[#d45f00]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                ממתין למלאי
              </button>
            </div>
          </OpsFlowOption>
        ))}
      </div>

      <OpsFlowNote>אישור הפעולה ישמור את מצב המלאי של כל פריט לצורך המשך תפעול ותיאום.</OpsFlowNote>

      <div className="sticky bottom-0 bg-transparent pb-1 pt-2">
        <OpsFlowPrimaryButton
          accent="primary"
          icon={isProcessing ? Loader2 : CheckCircle2}
          disabled={isProcessing || !allSet}
          loading={isProcessing}
          onClick={() => void onSubmit()}
        >
          {isProcessing ? 'שומר סטטוס פריטים...' : 'אשר מצב פריטים'}
        </OpsFlowPrimaryButton>
      </div>
    </div>
  );
}

// ─── Read-Only Views ───

interface OrderOpsItemsSummaryProps {
  items: OpsItem[];
}

export function OrderOpsItemsSummary({ items }: Readonly<OrderOpsItemsSummaryProps>) {
  const allocatedCount = items.filter(
    (i) => i.allocationStatus === 'ALLOCATED' || i.received
  ).length;

  return (
    <div className="space-y-4">
      <OpsFlowHero
        accent="primary"
        icon={CheckCircle2}
        title="סטטוס פריטים"
        description="כל הפריטים עודכנו — שלב זה הושלם."
        aside={
          <EntityBadge label={`✓ ${allocatedCount}/${items.length}`} tone="success" className="shadow-sm" />
        }
      />

      <div className="space-y-2">
        {items.map((item) => {
          const isReady = item.allocationStatus === 'ALLOCATED' || item.received;
          const isOnOrder = item.allocationStatus === 'ON_ORDER';
          return (
            <OpsFlowOption
              key={item.id}
              accent={isReady ? 'success' : isOnOrder ? 'warning' : 'primary'}
              icon={isReady ? CheckCircle2 : isOnOrder ? ShoppingCart : Package}
              title={item.name}
              description={`כמות: ${item.quantity}${item.sku ? ` • מק״ט ${item.sku}` : ''}`}
              active={isReady}
            >
              <EntityBadge
                label={isReady ? 'מוכן' : isOnOrder ? 'בהזמנה מספק' : 'ממתין'}
                tone={isReady ? 'success' : isOnOrder ? 'warning' : 'info'}
                className="tracking-wider"
              />
            </OpsFlowOption>
          );
        })}
      </div>
    </div>
  );
}

interface OrderOpsScheduleConfirmedProps {
  scheduledAt: string | Date;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  notes?: string | null;
  isCompleted: boolean;
  onEdit?: () => void;
}

export function OrderOpsScheduleConfirmed({
  scheduledAt,
  timeWindowStart,
  timeWindowEnd,
  notes,
  isCompleted,
  onEdit,
}: Readonly<OrderOpsScheduleConfirmedProps>) {
  const scheduleLabel = formatOpsSchedule(scheduledAt, timeWindowStart, timeWindowEnd);

  return (
    <div className="space-y-4">
      <OpsFlowHero
        accent={isCompleted ? 'success' : 'primary'}
        icon={isCompleted ? CheckCircle2 : Calendar}
        title={isCompleted ? 'תיאום הושלם' : 'מועד מסירה מתואם'}
        description={isCompleted ? 'ההזמנה הושלמה בהצלחה.' : 'מועד המסירה נקבע ואושר.'}
        aside={
          <EntityBadge
            label={isCompleted ? '✓ הושלם' : '✓ תואם'}
            tone={isCompleted ? 'success' : 'info'}
            className="shadow-sm"
          />
        }
      />

      <OpsFlowOption
        accent="primary"
        icon={Calendar}
        title="מועד אספקה"
        description={scheduleLabel}
        active
      />

      {notes ? (
        <OpsFlowOption
          accent="primary"
          icon={Truck}
          title="הערות לצוות"
          description={notes}
          active={false}
        />
      ) : null}

      {!isCompleted && onEdit ? (
        <div className="sticky bottom-0 bg-transparent pb-1 pt-2">
          <OpsFlowPrimaryButton
            accent="primary"
            icon={Calendar}
            onClick={onEdit}
          >
            שנה תיאום
          </OpsFlowPrimaryButton>
        </div>
      ) : null}
    </div>
  );
}

// ─── End Read-Only Views ───

interface OrderOpsPurchaseFormProps {
  items: OpsItem[];
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  supplierOptions: SupplierOption[];
  suppliersLoading: boolean;
  supplierByItemId: Record<string, string>;
  setSupplierForItem: (itemId: string, supplierId: string) => void;
  expectedDate: string;
  setExpectedDate: (value: string) => void;
  supplierDetails: string;
  setSupplierDetails: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onSubmit: () => Promise<void>;
  onBack?: () => void;
  isProcessing: boolean;
}

export function OrderOpsPurchaseForm({
  items,
  selectedIds,
  setSelectedIds,
  supplierOptions,
  suppliersLoading,
  supplierByItemId,
  setSupplierForItem,
  expectedDate,
  setExpectedDate,
  supplierDetails,
  setSupplierDetails,
  notes,
  setNotes,
  onSubmit,
  onBack,
  isProcessing,
}: Readonly<OrderOpsPurchaseFormProps>) {
  return (
    <div className="space-y-4">
      <OrderOpsBackButton onBack={onBack} />

      <OpsFlowHero
        accent="warning"
        icon={ShoppingCart}
        title="העברה לרכש"
        description="בחר את הפריטים שחסרים במלאי והשלם עבורם פרטי רכש."
        aside={
          <EntityBadge label={`${selectedIds.length} מסומנים`} tone="warning" className="shadow-sm" />
        }
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">בחר פריטים לרכש</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(items.map((item) => item.id))}
              className="text-xs font-bold text-[#d45f00] hover:underline"
            >
              בחר הכל
            </button>
            <span className="text-xs text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-500 hover:underline"
            >
              נקה
            </button>
          </div>
        </div>

        {suppliersLoading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" /> טוען ספקים...
          </div>
        ) : null}

        {items.map((item) => {
          const checked = selectedIds.includes(item.id);
          const selectedSupplierId = supplierByItemId[item.id] || item.supplierId || '';
          const itemSupplierOptions =
            selectedSupplierId &&
            !supplierOptions.some((supplier) => supplier.id === selectedSupplierId)
              ? [
                  { id: selectedSupplierId, name: item.supplierName || 'ספק משויך' },
                  ...supplierOptions,
                ]
              : supplierOptions;

          return (
            <OpsFlowOption
              key={item.id}
              accent="warning"
              icon={ShoppingCart}
              title={item.name}
              description={`כמות: ${item.quantity}`}
              active={checked}
              trailing={
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSelectedIds((previous) =>
                      previous.includes(item.id)
                        ? previous.filter((id) => id !== item.id)
                        : [...previous, item.id]
                    )
                  }
                  className="h-5 w-5 rounded border-slate-300 accent-amber-600"
                />
              }
            >
              {checked ? (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">ספק</label>
                  <select
                    name={`supplierId-${item.id}`}
                    value={selectedSupplierId}
                    onChange={(event) => setSupplierForItem(item.id, event.target.value)}
                    className="w-full min-w-0 break-words rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:text-sm font-bold shadow-sm"
                  >
                    <option value="">בחר ספק</option>
                    {itemSupplierOptions.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </OpsFlowOption>
          );
        })}
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">צפי קבלת מלאי</label>
          <input
            type="date"
            name="expectedDate"
            value={expectedDate}
            onChange={(event) => setExpectedDate(event.target.value)}
            className="w-full min-w-0 break-words rounded-xl border border-white/60 px-4 py-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: 'היום', days: 0 },
              { label: 'מחר', days: 1 },
              { label: '+3 ימים', days: 3 },
              { label: '+7 ימים', days: 7 },
            ].map(({ label, days }) => (
              <button
                key={label}
                type="button"
                onClick={() => setExpectedDate(buildDateOnlyShortcut(days))}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">פרטי ספק</label>
          <input
            type="text"
            name="supplierDetails"
            autoComplete="off"
            value={supplierDetails}
            onChange={(event) => setSupplierDetails(event.target.value)}
            placeholder="שם/טלפון/הערה לספק"
            className="w-full min-w-0 break-words rounded-xl border border-white/60 px-4 py-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">הערות רכש</label>
          <textarea
            name="purchaseNotes"
            autoComplete="off"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="הערות חופשיות למחלקת רכש"
            className="w-full min-w-0 break-words rounded-xl border border-white/60 px-4 py-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:text-sm"
          />
        </div>
      </div>

      <OpsFlowNote>הפעולה תשלח את הפריטים המסומנים ל-workflow של רכש ותעדכן צפי אספקה.</OpsFlowNote>

      <OpsFlowPrimaryButton
        accent="warning"
        icon={isProcessing ? Loader2 : ShoppingCart}
        disabled={isProcessing || selectedIds.length === 0}
        loading={isProcessing}
        onClick={() => void onSubmit()}
      >
        {isProcessing ? 'יוצר הזמנת רכש...' : `צור הזמנת רכש (${selectedIds.length} פריטים)`}
      </OpsFlowPrimaryButton>
    </div>
  );
}

interface OrderOpsScheduleFormProps {
  orderId: string;
  scheduledDate: string;
  setScheduledDate: (value: string) => void;
  scheduleWindow: string;
  setScheduleWindow: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  existingSchedule: string | Date | null;
  existingTimeWindowStart?: string | null;
  existingTimeWindowEnd?: string | null;
  customerPhone: string | null;
  whatsappPhone: string | null;
  onSubmit: () => Promise<void>;
  onBack?: () => void;
  isProcessing: boolean;
}

export function OrderOpsScheduleForm({
  orderId,
  scheduledDate,
  setScheduledDate,
  scheduleWindow,
  setScheduleWindow,
  notes,
  setNotes,
  existingSchedule,
  existingTimeWindowStart,
  existingTimeWindowEnd,
  customerPhone,
  whatsappPhone,
  onSubmit,
  onBack,
  isProcessing,
}: Readonly<OrderOpsScheduleFormProps>) {
  const [customerContacted, setCustomerContacted] = useState(Boolean(existingSchedule));
  const [scheduleConfirmed, setScheduleConfirmed] = useState(Boolean(existingSchedule));

  useEffect(() => {
    if (!existingSchedule) return;
    setCustomerContacted(true);
    setScheduleConfirmed(true);
  }, [existingSchedule]);

  return (
    <div className="space-y-4">
      <OrderOpsBackButton onBack={onBack} />

      <OpsFlowHero
        accent="primary"
        icon={Calendar}
        title="תיאום זמן משלוח"
        description="קבע מועד, אשר קשר עם הלקוח, ושמור את התיאום במערכת."
        aside={
          existingSchedule ? (
            <EntityBadge label="קיים תיאום" tone="info" className="shadow-sm" />
          ) : null
        }
      />

      <div className="space-y-3">
        <OpsFlowOption
          accent="primary"
          icon={Phone}
          title="תיאום מול הלקוח בוצע"
          description="ודא שהלקוח עודכן וקיבל את חלון הזמן הרלוונטי."
          active={customerContacted}
          trailing={
            <input
              type="checkbox"
              checked={customerContacted}
              aria-label="תיאום מול הלקוח בוצע"
              onChange={(event) => setCustomerContacted(event.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-primary-500 accent-primary-500"
            />
          }
        />
        <OpsFlowOption
          accent="primary"
          icon={Clock3}
          title="מועד מסירה נקבע"
          description={
            existingSchedule
              ? `מועד קיים: ${formatOpsSchedule(
                  existingSchedule,
                  existingTimeWindowStart,
                  existingTimeWindowEnd
                )}`
              : 'בחר תאריך וחלון אספקה ואשר אותם לפני השמירה.'
          }
          active={scheduleConfirmed}
          trailing={
            <input
              type="checkbox"
              checked={scheduleConfirmed}
              aria-label="מועד מסירה נקבע"
              onChange={(event) => setScheduleConfirmed(event.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-primary-500 accent-primary-500"
            />
          }
        />
      </div>

      <SmartSchedulePlanner
        orderId={orderId}
        scheduledDate={scheduledDate}
        setScheduledDate={setScheduledDate}
        scheduleWindow={scheduleWindow}
        setScheduleWindow={setScheduleWindow}
        existingSchedule={existingSchedule}
        disabled={isProcessing}
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">הערות לצוות</label>
        <textarea
          name="scheduleNotes"
          autoComplete="off"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="לדוגמה: פעמיים בפעמון, הגישה מהחנייה האחורית"
          className="w-full min-w-0 break-words rounded-xl border border-white/60 px-4 py-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:text-sm"
        />
      </div>

      {whatsappPhone || customerPhone ? (
        <div className="rounded-[20px] border border-white/60 bg-white/50 px-4 py-3 backdrop-blur-md">
          <p className="mb-2 text-xs font-medium text-slate-600">עדכן את הלקוח</p>
          <div className="flex gap-2">
            {whatsappPhone ? (
              <a
                href={`https://wa.me/${whatsappPhone}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/60 bg-white/70 py-2.5 text-sm font-medium text-slate-700 backdrop-blur-sm transition-colors hover:bg-white/80"
              >
                <MessageCircle className="h-4 w-4 text-green-600" />
                וואטסאפ
              </a>
            ) : null}
            {customerPhone ? (
              <a
                href={`tel:${customerPhone}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/60 bg-white/70 py-2.5 text-sm font-medium text-slate-700 backdrop-blur-sm transition-colors hover:bg-white/80"
              >
                <Phone className="h-4 w-4 text-blue-600" />
                חייג
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <OpsFlowNote>
        בלחיצה על אישור המועד יישמר בהזמנה. היציאה לדרך או להתקנה מסומנת בפס השלבים.
      </OpsFlowNote>

      <div className="sticky bottom-0 bg-transparent pb-1 pt-2">
        <OpsFlowPrimaryButton
          accent="primary"
          icon={isProcessing ? Loader2 : Truck}
          disabled={isProcessing || !scheduledDate || !scheduleWindow || !customerContacted || !scheduleConfirmed}
          loading={isProcessing}
          onClick={() => void onSubmit()}
        >
          {isProcessing ? 'שומר תיאום...' : 'אשר וקבע מועד אספקה'}
        </OpsFlowPrimaryButton>
      </div>
    </div>
  );
}

const DELIVERY_CHECKLIST_ITEMS = [
  { id: 'delivery_address_verified', label: 'הכתובת והגישה ללקוח אומתו', required: true },
  { id: 'delivery_customer_contacted', label: 'הלקוח עודכן לפני הגעה', required: true },
  { id: 'delivery_items_loaded', label: 'כל הפריטים הועמסו ונבדקו', required: true },
  { id: 'delivery_completed_on_site', label: 'האספקה/ההתקנה הושלמה בשטח', required: true },
] as const;

const DELIVERY_START_STATUSES = new Set(['READY']);
const DELIVERY_COMPLETE_STATUSES = new Set(['IN_TRANSIT', 'INSTALLATION']);
const DELIVERY_DONE_STATUSES = new Set(['COMPLETED']);

interface OrderOpsDeliveryFormProps {
  status: string;
  customerName: string;
  address: string;
  scheduledLabel: string;
  etaLabel: string;
  notes?: string | null;
  customerPhone: string | null;
  whatsappPhone: string | null;
  wazeHref: string;
  checklistState: Record<string, boolean>;
  onToggleChecklist: (itemId: string, checked: boolean) => Promise<void>;
  onStartDelivery: () => Promise<void>;
  onCompleteDelivery: () => Promise<void>;
  onBack?: () => void;
  isProcessing: boolean;
}

export function OrderOpsDeliveryForm({
  status,
  customerName,
  address,
  scheduledLabel,
  etaLabel,
  notes,
  customerPhone,
  whatsappPhone,
  wazeHref,
  checklistState,
  onToggleChecklist,
  onStartDelivery,
  onCompleteDelivery,
  onBack,
  isProcessing,
}: Readonly<OrderOpsDeliveryFormProps>) {
  const canStartDelivery = DELIVERY_START_STATUSES.has(status);
  const canCompleteDelivery = DELIVERY_COMPLETE_STATUSES.has(status);
  const isCompleted = DELIVERY_DONE_STATUSES.has(status);
  const completedCount = DELIVERY_CHECKLIST_ITEMS.filter((item) => Boolean(checklistState[item.id])).length;
  const allRequiredChecked = DELIVERY_CHECKLIST_ITEMS.every((item) => !item.required || checklistState[item.id]);

  return (
    <div className="space-y-4">
      <OrderOpsBackButton onBack={onBack} />

      <OpsFlowHero
        accent="primary"
        icon={Truck}
        title="ביצוע אספקה"
        description="כלי העבודה לשטח: ניווט, קשר עם הלקוח ואישור השלמת המסירה."
        aside={
          <EntityBadge
            label={`${completedCount}/${DELIVERY_CHECKLIST_ITEMS.length}`}
            tone="info"
            className="backdrop-blur-sm"
          />
        }
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <OpsFlowOption
          accent="primary"
          icon={MapPin}
          title="כתובת מלאה"
          description={address}
          active
        >
          <div className="rounded-2xl bg-white/80 px-3 py-2 text-[12px] font-semibold text-[#34517a]">
            {customerName}
          </div>
        </OpsFlowOption>

        <OpsFlowOption
          accent="primary"
          icon={Calendar}
          title="זמן יעד לאספקה"
          description={scheduledLabel}
          active
        >
          <div className="rounded-2xl bg-white/80 px-3 py-2 text-[12px] font-semibold text-[#34517a]">
            ETA בניווט: {etaLabel}
          </div>
        </OpsFlowOption>
      </div>

      {notes ? (
        <OpsFlowNote>{notes}</OpsFlowNote>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <a
          href={wazeHref}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] border border-white/60 bg-white/60 backdrop-blur-sm px-4 py-3 text-sm font-black text-primary-600 transition hover:bg-primary-100"
        >
          <Navigation className="h-4 w-4" />
          פתח Waze
        </a>

        {customerPhone ? (
          <a
            href={`tel:${customerPhone}`}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] border border-white/60 bg-white/70 px-4 py-3 text-sm font-black text-[#334155] backdrop-blur-sm transition hover:bg-white/80"
          >
            <Phone className="h-4 w-4 text-primary-600" />
            חייג ללקוח
          </a>
        ) : (
          <div className="flex min-h-[52px] items-center justify-center rounded-[18px] border border-dashed border-white/60 bg-white/40 backdrop-blur-sm px-4 py-3 text-sm font-bold text-[#94a3b8]">
            אין מספר טלפון
          </div>
        )}

        {whatsappPhone ? (
          <a
            href={`https://wa.me/${whatsappPhone}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] border border-white/60 bg-white/60 px-4 py-3 text-sm font-black text-[#008c39] backdrop-blur-sm transition hover:bg-white/80"
          >
            <MessageCircle className="h-4 w-4" />
            וואטסאפ
          </a>
        ) : (
          <div className="flex min-h-[52px] items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-[#94a3b8] shadow-sm">
            אין וואטסאפ
          </div>
        )}
      </div>

      <div className="space-y-2">
        {DELIVERY_CHECKLIST_ITEMS.map((item) => (
          <OpsFlowOption
            key={item.id}
            accent={checklistState[item.id] ? 'success' : 'primary'}
            icon={checklistState[item.id] ? CheckCircle2 : Truck}
            title={item.label}
            description={item.required ? 'חובה לפני סיום ההזמנה' : 'אופציונלי'}
            active={Boolean(checklistState[item.id])}
            trailing={
              <input
                type="checkbox"
                checked={Boolean(checklistState[item.id])}
                onChange={(event) => {
                  void onToggleChecklist(item.id, event.target.checked);
                }}
                disabled={isProcessing}
                className="h-5 w-5 rounded border-slate-300 text-primary-500 accent-primary-500"
              />
            }
          />
        ))}
      </div>

      <OpsFlowNote>
        Waze יספק את זמן ההגעה המדויק לאחר פתיחת הניווט. הסיום יתאפשר רק אחרי אישור כל שלבי הביצוע.
      </OpsFlowNote>

      <div className="sticky bottom-0 bg-transparent pb-1 pt-2">
        {isCompleted ? (
          <OpsFlowPrimaryButton
            accent="success"
            icon={CheckCircle2}
            disabled
            onClick={() => {}}
          >
            ההזמנה הושלמה
          </OpsFlowPrimaryButton>
        ) : (
          <OpsFlowPrimaryButton
            accent="primary"
            icon={isProcessing ? Loader2 : canCompleteDelivery ? CheckCircle2 : Truck}
            disabled={
              isProcessing ||
              (!canStartDelivery && !canCompleteDelivery) ||
              (canCompleteDelivery && !allRequiredChecked)
            }
            loading={isProcessing}
            onClick={() => {
              if (canCompleteDelivery) {
                void onCompleteDelivery();
                return;
              }
              void onStartDelivery();
            }}
          >
            {isProcessing
              ? 'שומר סטטוס משלוח...'
              : canCompleteDelivery
                ? 'אשר מסירה וסיים הזמנה'
                : 'סמן יציאה למשלוח'}
          </OpsFlowPrimaryButton>
        )}
      </div>
    </div>
  );
}

const ISSUE_TYPES = [
  'פריט חסר במחסן',
  'פריט פגום',
  'פריט שגוי/אחר ממה שהוזמן',
  'עיכוב באספקה מספק',
  'בעיית כמות',
  'אחר',
];

interface OrderOpsIssueFormProps {
  items: OpsItem[];
  customerPhone: string | null;
  whatsappPhone: string | null;
  onSubmit: (itemName: string, description: string) => Promise<void>;
  onBack?: () => void;
  isProcessing: boolean;
}

export function OrderOpsIssueForm({
  items,
  customerPhone,
  whatsappPhone,
  onSubmit,
  onBack,
  isProcessing,
}: Readonly<OrderOpsIssueFormProps>) {
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id ?? '');
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');

  const selectedItem = items.find((item) => item.id === selectedItemId);
  const fullDescription = [issueType, description].filter(Boolean).join(' — ');

  return (
    <div className="space-y-4">
      <OrderOpsBackButton onBack={onBack} />

      <OpsFlowHero
        accent="danger"
        icon={AlertCircle}
        title="דיווח בעיה בפריט"
        description="בחר את הפריט, סמן את סוג הבעיה, ותעדכן את הלקוח במידת הצורך."
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">הפריט הבעייתי</label>
        <div className="space-y-2">
          {items.map((item) => (
            <OpsFlowOption
              key={item.id}
              accent="danger"
              icon={AlertCircle}
              title={item.name}
              description={`כמות: ${item.quantity}`}
              active={selectedItemId === item.id}
              trailing={
                <input
                  type="radio"
                  name="issue-item"
                  value={item.id}
                  checked={selectedItemId === item.id}
                  onChange={() => setSelectedItemId(item.id)}
                  className="h-5 w-5 accent-rose-600"
                />
              }
            >
              {selectedItemId === item.id ? (
                <div className="rounded-2xl bg-white/70 px-3 py-2 text-[12px] font-semibold text-[#db3b0a]">
                  הפריט מסומן לטיפול
                </div>
              ) : null}
            </OpsFlowOption>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">סוג הבעיה</label>
        <div className="flex flex-wrap gap-2">
          {ISSUE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setIssueType(issueType === type ? '' : type)}
              className={cn(
                'rounded-full border px-3 py-2 text-sm transition-colors touch-manipulation',
                issueType === type
                  ? 'border-rose-300 bg-rose-100 font-medium text-rose-700'
                  : 'border-white/60 bg-white/70 text-slate-600 hover:bg-white/80 backdrop-blur-sm'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          פרטים נוספים (אופציונלי)
        </label>
        <textarea
          name="issueDescription"
          autoComplete="off"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="תאר את הבעיה בפירוט..."
          className="w-full min-w-0 break-words rounded-xl border border-white/60 px-4 py-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 sm:text-sm"
        />
      </div>

      <div className="rounded-[20px] border border-white/60 bg-white/50 px-4 py-3 backdrop-blur-md">
        <p className="mb-2 text-sm font-medium text-slate-700">יצירת קשר עם הלקוח</p>
        <div className="flex gap-2">
          {whatsappPhone ? (
            <a
              href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
                selectedItem
                  ? `שלום, בנוגע להזמנתך — יש בעיה עם הפריט "${selectedItem.name}". ${issueType ? `סוג הבעיה: ${issueType}.` : ''} ${description || ''}`
                  : 'שלום, רצינו לעדכן אותך בנוגע להזמנה'
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/70 py-3 text-sm font-medium text-slate-700 backdrop-blur-sm transition-colors hover:bg-white/80"
            >
              <MessageCircle className="h-5 w-5 text-green-600" />
              וואטסאפ
            </a>
          ) : null}
          {customerPhone ? (
            <a
              href={`tel:${customerPhone}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/70 py-3 text-sm font-medium text-slate-700 backdrop-blur-sm transition-colors hover:bg-white/80"
            >
              <Phone className="h-5 w-5 text-blue-600" />
              חייג ללקוח
            </a>
          ) : null}
        </div>
      </div>

      <OpsFlowNote>הבעיה תתועד בהזמנה ותשמש את הצוות להמשך טיפול מול הלקוח או הספק.</OpsFlowNote>

      <OpsFlowPrimaryButton
        accent="danger"
        icon={isProcessing ? Loader2 : AlertCircle}
        disabled={isProcessing}
        loading={isProcessing}
        onClick={() =>
          void onSubmit(selectedItem?.name ?? 'פריט', fullDescription || 'בעיה לא מפורטת')
        }
      >
        {isProcessing ? 'שומר...' : 'אשר ותעד בעיה'}
      </OpsFlowPrimaryButton>
    </div>
  );
}
