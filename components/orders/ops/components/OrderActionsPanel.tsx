'use client';

import {
  EntityBadge,
  EntityNotice,
  EntitySurface,
  type EntityTone,
} from '@/components/shared/display/EntityPrimitives';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import { useToast } from '@/components/ui/ToastProvider';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  Loader2,
  MapPin,
  Scissors,
  Square,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useEffect } from 'react';

import {
  OpsFlowHero,
  OpsFlowNote,
  OpsFlowPrimaryButton,
} from '../OpsFlowPrimitives';
import type { OpsItem } from '../workflow/types';

interface OrderActionsPanelProps {
  orderId: string;
  orderNumber?: string | null;
  items: OpsItem[];
  onSuccess: () => void;
  initialAction?: ActionId | null;
}

type ActionId = 'address' | 'split' | 'cancel';

const ORDER_ACTIONS = [
  {
    id: 'address' as const,
    label: 'שינוי כתובת משלוח',
    description: 'עדכון כתובת המשלוח של ההזמנה',
    icon: MapPin,
    tone: 'info' as const,
  },
  {
    id: 'split' as const,
    label: 'פיצול הזמנה',
    description: 'העברת פריטים נבחרים להזמנה חדשה נפרדת',
    icon: Scissors,
    tone: 'neutral' as const,
  },
  {
    id: 'cancel' as const,
    label: 'ביטול הזמנה',
    description: 'ביטול הזמנה זו וכל הרשומות הקשורות אליה',
    icon: XCircle,
    tone: 'warning' as const,
  },
];

function getActionToneClasses(tone: EntityTone) {
  switch (tone) {
    case 'info':
      return {
        button: 'border-primary-100 bg-white text-primary-600 hover:bg-primary-50',
        iconWrap: 'bg-primary-50 text-primary-500',
      };
    case 'warning':
      return {
        button: 'border-[#ffd9bf] bg-white text-[#d45f00] hover:bg-[#fff6ed]',
        iconWrap: 'bg-[#fff6ed] text-[#d45f00]',
      };
    case 'success':
      return {
        button: 'border-emerald-200 bg-white text-[#008c39] hover:bg-emerald-50',
        iconWrap: 'bg-emerald-50 text-[#008c39]',
      };
    case 'accent':
      return {
        button: 'border-violet-100 bg-white text-violet-700 hover:bg-violet-50',
        iconWrap: 'bg-violet-50 text-violet-700',
      };
    case 'neutral':
    default:
      return {
        button: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        iconWrap: 'bg-slate-100 text-slate-500',
      };
  }
}

function BackButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
    >
      <ArrowRight className="h-4 w-4" />
      חזור לפעולות
    </button>
  );
}

// ─── Cancel Inline Form ──────────────────────────────────────────────────────

function CancelForm({
  orderId,
  orderNumber,
  onSuccess,
  onBack,
}: {
  orderId: string;
  orderNumber?: string | null;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [cancelRelated, setCancelRelated] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = async () => {
    if (!reason.trim()) {
      toast.warning('יש לציין סיבת ביטול');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), cancelRelatedRecords: cancelRelated }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'שגיאה בביטול ההזמנה');
      }
      toast.success('ההזמנה בוטלה בהצלחה');
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בביטול ההזמנה');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      <OpsFlowHero
        accent="danger"
        icon={XCircle}
        title={`ביטול הזמנה${orderNumber ? ` #${orderNumber}` : ''}`}
        description="ביטול ההזמנה הוא פעולה בלתי הפיכה. ודא שכל הפרטים נכונים לפני האישור."
      />

      <EntityNotice
        icon={AlertTriangle}
        title="הפעולה תשפיע גם על הרשומות הקשורות"
        description="הזמנות רכש, משימות ואירועי לוח שנה קשורים יבוטלו אף הם. פעולה זו בלתי הפיכה."
        tone="warning"
      />

      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-[#475569]">סיבת ביטול *</Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="למשל: ביטול לפי בקשת הלקוח"
          className="h-11 rounded-xl border-white/60 bg-white/70 backdrop-blur-sm"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-[14px] border border-slate-200 bg-white px-4 py-4 shadow-sm transition-colors hover:bg-slate-50">
        <input
          type="checkbox"
          checked={cancelRelated}
          onChange={(e) => setCancelRelated(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-600"
        />
        <span className="text-sm font-black text-[#334155]">
          בטל גם הזמנות רכש, משימות ואירועים קשורים
        </span>
      </label>

      <OpsFlowNote>לאחר הביטול, לא ניתן יהיה לשחזר את ההזמנה או את הרשומות שבוטלו.</OpsFlowNote>

      <OpsFlowPrimaryButton
        accent="danger"
        icon={isLoading ? Loader2 : XCircle}
        disabled={isLoading || !reason.trim()}
        loading={isLoading}
        onClick={() => void handleCancel()}
      >
        {isLoading ? 'מבטל...' : 'אשר ביטול הזמנה'}
      </OpsFlowPrimaryButton>
    </div>
  );
}

// ─── Change Address Inline Form ──────────────────────────────────────────────

function ChangeAddressForm({
  orderId,
  orderNumber,
  onSuccess,
  onBack,
}: {
  orderId: string;
  orderNumber?: string | null;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [apartment, setApartment] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddressSelect = (addr: {
    city?: string;
    street?: string;
    streetNumber?: string;
    lat?: number | string | null;
    lng?: number | string | null;
  }) => {
    if (addr.city) setCity(addr.city);
    if (addr.street) setStreet(addr.street);
    if (addr.streetNumber) setNumber(addr.streetNumber);
  };

  const handleSave = async () => {
    if (!city.trim() || !street.trim() || !number.trim()) {
      toast.warning('יש למלא עיר, רחוב ומספר בית');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/address`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: city.trim(),
          street: street.trim(),
          number: number.trim(),
          floor: floor.trim() || undefined,
          apartment: apartment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'שגיאה בעדכון הכתובת');
      }
      toast.success('הכתובת עודכנה בהצלחה');
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בעדכון הכתובת');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      <OpsFlowHero
        accent="primary"
        icon={MapPin}
        title={`שינוי כתובת${orderNumber ? ` — #${orderNumber}` : ''}`}
        description="חפש כתובת חדשה או הזן ידנית את פרטי הכתובת."
      />

      <EntitySurface className="rounded-[16px] px-4 py-4">
        <Label className="mb-2 block text-xs font-black tracking-wide text-primary-600">חיפוש כתובת מהיר (Google Maps)</Label>
        <PlacesAutocomplete onAddressSelect={handleAddressSelect} />
      </EntitySurface>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 space-y-1">
          <Label className="text-xs font-bold text-[#475569]">עיר *</Label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="תל אביב"
            className="h-10 rounded-xl border-white/60 bg-white/70 backdrop-blur-sm"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs font-bold text-[#475569]">רחוב *</Label>
          <Input
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="שם הרחוב"
            className="h-10 rounded-xl border-white/60 bg-white/70 backdrop-blur-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold text-[#475569]">מספר *</Label>
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="1"
            className="h-10 rounded-xl border-white/60 bg-white/70 backdrop-blur-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold text-[#475569]">קומה</Label>
          <Input
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="3"
            className="h-10 rounded-xl border-white/60 bg-white/70 backdrop-blur-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold text-[#475569]">דירה</Label>
          <Input
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            placeholder="12"
            className="h-10 rounded-xl border-white/60 bg-white/70 backdrop-blur-sm"
          />
        </div>
      </div>

      {city && street && number && (
        <EntityNotice
          icon={MapPin}
          title="כתובת חדשה לעדכון"
          description={`${street} ${number}, ${city}${floor ? `, קומה ${floor}` : ''}${apartment ? ` דירה ${apartment}` : ''}`}
          tone="success"
        />
      )}

      <OpsFlowPrimaryButton
        accent="primary"
        icon={isLoading ? Loader2 : MapPin}
        disabled={isLoading || !city.trim() || !street.trim() || !number.trim()}
        loading={isLoading}
        onClick={() => void handleSave()}
      >
        {isLoading ? 'שומר כתובת...' : 'שמור כתובת חדשה'}
      </OpsFlowPrimaryButton>
    </div>
  );
}

// ─── Split Order Inline Form ─────────────────────────────────────────────────

function SplitOrderForm({
  orderId,
  orderNumber,
  items,
  onSuccess,
  onBack,
}: {
  orderId: string;
  orderNumber?: string | null;
  items: OpsItem[];
  onSuccess: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSplit = async () => {
    if (selectedIds.size === 0) {
      toast.warning('יש לבחור לפחות פריט אחד לפיצול');
      return;
    }
    if (selectedIds.size === items.length) {
      toast.warning('לא ניתן להעביר את כל הפריטים — יש להשאיר לפחות פריט אחד בהזמנה המקורית');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'שגיאה בפיצול ההזמנה');
      }
      toast.success(data.message || `הזמנה חדשה #${data.data?.newOrderNumber} נוצרה בהצלחה`);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בפיצול ההזמנה');
    } finally {
      setIsLoading(false);
    }
  };

  const remainingCount = items.length - selectedIds.size;

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      <OpsFlowHero
        accent="warning"
        icon={Scissors}
        title={`פיצול הזמנה${orderNumber ? ` #${orderNumber}` : ''}`}
        description="בחר את הפריטים שיועברו להזמנה חדשה. ההזמנה המקורית תמשיך לכלול את הפריטים שנותרו."
      />

      {items.length === 0 ? (
        <EntityNotice
          title="אין פריטים בהזמנה זו"
          description="לא ניתן לבצע פיצול בלי לבחור פריטים קיימים."
          tone="neutral"
          className="border-dashed py-6 text-center"
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <EntityBadge label={`נבחרו ${selectedIds.size}`} tone="neutral" size="sm" />
            <button
              type="button"
              onClick={() =>
                selectedIds.size === items.length
                  ? setSelectedIds(new Set())
                  : setSelectedIds(new Set(items.map((i) => i.id)))
              }
              className="text-[11px] font-bold text-primary-600"
            >
              {selectedIds.size === items.length ? 'בטל הכל' : 'בחר הכל'}
            </button>
          </div>
          {items.map((item) => {
            const checked = selectedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[16px] border px-4 py-4 text-right transition-all shadow-sm',
                  checked
                    ? 'border-[#ffd9bf] bg-[#fff6ed]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                )}
              >
                {checked ? (
                  <CheckSquare className="h-5 w-5 shrink-0 text-[#d45f00]" />
                ) : (
                  <Square className="h-5 w-5 shrink-0 text-[#94a3b8]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-[#0f172a]">{item.name}</div>
                  <div className="text-[11px] font-bold text-[#64748b]">
                    {item.sku ? `${item.sku} · ` : ''}כמות: {item.quantity}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedIds.size > 0 && selectedIds.size < items.length && (
        <div className="grid grid-cols-2 gap-3 text-center text-xs font-black">
          <EntityBadge
            label={`הזמנה חדשה: ${selectedIds.size} פריטים`}
            tone="warning"
            size="md"
            className="justify-center"
          />
          <EntityBadge
            label={`מקורית: ${remainingCount} פריטים`}
            tone="neutral"
            size="md"
            className="justify-center"
          />
        </div>
      )}

      <OpsFlowNote>הפעולה תיצור הזמנה חדשה עם הפריטים שנבחרו. ההזמנה המקורית תישאר עם הפריטים הנותרים.</OpsFlowNote>

      <OpsFlowPrimaryButton
        accent="warning"
        icon={isLoading ? Loader2 : Scissors}
        disabled={isLoading || selectedIds.size === 0 || selectedIds.size === items.length}
        loading={isLoading}
        onClick={() => void handleSplit()}
      >
        {isLoading ? 'מפצל...' : `צור הזמנה חדשה (${selectedIds.size} פריטים)`}
      </OpsFlowPrimaryButton>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export function OrderActionsPanel({
  orderId,
  orderNumber,
  items,
  onSuccess,
  initialAction = null,
}: OrderActionsPanelProps) {
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);

  useEffect(() => {
    setActiveAction(initialAction);
  }, [initialAction]);

  if (activeAction === 'cancel') {
    return (
      <CancelForm
        orderId={orderId}
        orderNumber={orderNumber}
        onSuccess={onSuccess}
        onBack={() => setActiveAction(null)}
      />
    );
  }

  if (activeAction === 'address') {
    return (
      <ChangeAddressForm
        orderId={orderId}
        orderNumber={orderNumber}
        onSuccess={onSuccess}
        onBack={() => setActiveAction(null)}
      />
    );
  }

  if (activeAction === 'split') {
    return (
      <SplitOrderForm
        orderId={orderId}
        orderNumber={orderNumber}
        items={items}
        onSuccess={onSuccess}
        onBack={() => setActiveAction(null)}
      />
    );
  }

  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-sm font-black text-slate-900">פעולות ניהול</h3>
        <p className="text-[11px] text-slate-500">שינוי כתובת, פיצול וביטול הזמנה.</p>
      </div>

      <div className="space-y-2">
        {ORDER_ACTIONS.map((action) => {
          const tone = getActionToneClasses(action.tone);

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => setActiveAction(action.id)}
              className={cn(
                'flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-right transition-all active:scale-[0.98]',
                tone.button
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                  tone.iconWrap
                )}
              >
                <action.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black">{action.label}</div>
                <div className="text-[11px] leading-4 opacity-85">{action.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
