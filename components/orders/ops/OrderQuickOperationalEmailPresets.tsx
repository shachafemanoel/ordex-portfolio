'use client';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/ToastProvider';
import apiClient from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { OperationalMessageKind } from '@prisma/client';
import { Loader2, Mail, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type PresetDto = {
  key: string;
  operationalKind: OperationalMessageKind;
  label: string;
  hint: string;
  hasTemplate: boolean;
  defaultTo: string | null;
  supplierId: string | null;
  disabledReason: string | null;
};

type QuickContactRow = { id: string; name: string; email: string };

type PresetsResponse = {
  googleReady: boolean;
  presets: PresetDto[];
};

export function OrderQuickOperationalEmailPresets({
  orderId,
  className,
  variant = 'default',
  onSent,
}: Readonly<{
  orderId: string;
  className?: string;
  variant?: 'default' | 'deliveries';
  onSent?: () => void;
}>) {
  const { success, error } = useToast();
  const [googleReady, setGoogleReady] = useState(false);
  const [presets, setPresets] = useState<PresetDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quick' | 'manual'>('quick');

  const [quickContacts, setQuickContacts] = useState<QuickContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [manualContactId, setManualContactId] = useState<string>('');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [saveToQuickList, setSaveToQuickList] = useState(false);
  const [sendingManual, setSendingManual] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/api/orders/${orderId}/operational-email/presets`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPresets([]);
        setGoogleReady(false);
        return;
      }
      const data = j.data as PresetsResponse | undefined;
      setGoogleReady(Boolean(data?.googleReady));
      setPresets(data?.presets ?? []);
    } catch {
      setPresets([]);
      setGoogleReady(false);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const supplierPreset = useMemo(
    () => presets.find((p) => p.key === 'order_items_supplier'),
    [presets]
  );
  const manualSupplierEnabled = Boolean(
    googleReady && supplierPreset?.hasTemplate
  );

  const loadQuickContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const res = await apiClient('/api/suppliers/quick-contacts');
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQuickContacts([]);
        return;
      }
      const items = (j.data?.items as QuickContactRow[] | undefined) ?? [];
      setQuickContacts(items);
      setContactsLoaded(true);
    } catch {
      setQuickContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'manual' && manualSupplierEnabled && !contactsLoaded) {
      void loadQuickContacts();
    }
  }, [activeTab, contactsLoaded, loadQuickContacts, manualSupplierEnabled]);

  useEffect(() => {
    if (!manualContactId) return;
    const row = quickContacts.find((c) => c.id === manualContactId);
    if (row) {
      setManualName(row.name);
      setManualEmail(row.email);
    }
  }, [manualContactId, quickContacts]);

  const sendPreset = async (p: PresetDto) => {
    if (!p.defaultTo || p.disabledReason) return;
    const idem =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setSendingKey(p.key);
    try {
      const body: Record<string, unknown> = {
        to: p.defaultTo,
        operationalKind: p.operationalKind,
      };
      if (p.supplierId) {
        body.supplierId = p.supplierId;
      }
      const res = await apiClient(`/api/orders/${orderId}/operational-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idem,
        },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          j?.error?.message || (typeof j?.detail === 'string' ? j.detail : 'שליחה נכשלה');
        throw new Error(msg);
      }
      success(`נשלח: ${p.label}`);
      onSent?.();
      void load();
    } catch (e) {
      error(e instanceof Error ? e.message : 'שגיאת שליחה');
    } finally {
      setSendingKey(null);
    }
  };

  const sendManualSupplier = async () => {
    const name = manualName.trim();
    const email = manualEmail.trim().toLowerCase();
    if (!name || !email) {
      error('מלאו שם ספק וכתובת אימייל');
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      error('כתובת אימייל לא תקינה');
      return;
    }

    const idem =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setSendingManual(true);
    try {
      let supplierId: string | undefined =
        manualContactId && quickContacts.some((c) => c.id === manualContactId)
          ? manualContactId
          : undefined;

      if (saveToQuickList) {
        const saveRes = await apiClient('/api/suppliers/quick-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email }),
        });
        const saveJ = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok) {
          const msg =
            saveJ?.error?.message ||
            (typeof saveJ?.detail === 'string' ? saveJ.detail : 'שמירת ספק נכשלה');
          throw new Error(msg);
        }
        const saved = saveJ.data as { id?: string } | undefined;
        if (saved?.id) {
          supplierId = saved.id;
        }
        void loadQuickContacts();
      }

      const body: Record<string, unknown> = {
        to: email,
        operationalKind: OperationalMessageKind.ORDER_ITEMS_SUPPLIER,
        fullOrderItemsForSupplierTemplate: true,
        supplierDisplayName: name,
      };
      if (supplierId) {
        body.supplierId = supplierId;
      }

      const res = await apiClient(`/api/orders/${orderId}/operational-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idem,
        },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          j?.error?.message || (typeof j?.detail === 'string' ? j.detail : 'שליחה נכשלה');
        throw new Error(msg);
      }
      success('נשלחו פריטי ההזמנה לספק');
      onSent?.();
      void load();
      if (!saveToQuickList) {
        setSaveToQuickList(false);
      }
    } catch (e) {
      error(e instanceof Error ? e.message : 'שגיאת שליחה');
    } finally {
      setSendingManual(false);
    }
  };

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-slate-500', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        טוען תבניות מהירות…
      </div>
    );
  }

  if (!presets.length) {
    return null;
  }

  const isDeliveries = variant === 'deliveries';
  const tabBtnBase =
    'rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40';
  const tabBtnActive = isDeliveries
    ? 'bg-white/90 text-[#0f172a] shadow-sm'
    : 'bg-slate-900 text-on-dark';
  const tabBtnIdle = isDeliveries
    ? 'text-[#475569] hover:bg-white/40'
    : 'text-slate-600 hover:bg-slate-100';

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-600">שליחה מהירה</div>
        {manualSupplierEnabled ? (
          <div
            role="tablist"
            className={cn(
              'inline-flex gap-0.5 rounded-full p-0.5',
              isDeliveries ? 'bg-white/35' : 'bg-slate-100'
            )}
            aria-label="מצב שליחה"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'quick'}
              className={cn(tabBtnBase, activeTab === 'quick' ? tabBtnActive : tabBtnIdle)}
              onClick={() => setActiveTab('quick')}
            >
              כפתורים
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'manual'}
              className={cn(tabBtnBase, activeTab === 'manual' ? tabBtnActive : tabBtnIdle)}
              onClick={() => setActiveTab('manual')}
            >
              ספק ידני / נשמר
            </button>
          </div>
        ) : null}
      </div>

      {activeTab === 'quick' ? (
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const blocked =
              Boolean(p.disabledReason) || !p.hasTemplate || !p.defaultTo?.trim();
            const title = blocked
              ? p.disabledReason ||
                (!p.hasTemplate ? 'הגדר תבנית אימייל פעילה באדמין' : 'לא ניתן לשלוח')
              : p.hint;

            return (
              <Button
                key={p.key}
                type="button"
                size="sm"
                variant={isDeliveries ? 'outline' : 'secondary'}
                disabled={Boolean(sendingKey) || blocked}
                title={title}
                className={cn(
                  'inline-flex items-center gap-1.5',
                  isDeliveries &&
                    'rounded-[14px] border-white/60 bg-white/50 text-[#0f172a] backdrop-blur-sm hover:bg-white/70'
                )}
                onClick={() => void sendPreset(p)}
              >
                {sendingKey === p.key ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 shrink-0 opacity-80" />
                )}
                <span>{p.label}</span>
              </Button>
            );
          })}
        </div>
      ) : manualSupplierEnabled ? (
        <div
          className={cn(
            'space-y-3 rounded-2xl border p-3 text-right',
            isDeliveries
              ? 'border-white/50 bg-white/40 backdrop-blur-sm'
              : 'border-slate-200 bg-slate-50/80'
          )}
        >
          <p className="text-[11px] leading-snug text-slate-600">
            שליחת כל פריטי ההזמנה לספק ללא קישור לשורות. בחרו מרשימה או הזינו ידנית; אפשר לשמור
            לשימוש חוזר.
          </p>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-600" htmlFor={`qc-${orderId}`}>
              מרשימת ספקים מהירים
            </label>
            <select
              id={`qc-${orderId}`}
              className={cn(
                'w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900',
                isDeliveries ? 'border-white/60' : 'border-slate-200'
              )}
              value={manualContactId}
              disabled={contactsLoading}
              onChange={(e) => setManualContactId(e.target.value)}
            >
              <option value="">— הזנה ידנית —</option>
              {quickContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
            {contactsLoading ? (
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                טוען רשימה…
              </div>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600" htmlFor={`qn-${orderId}`}>
                שם הספק
              </label>
              <Input
                id={`qn-${orderId}`}
                dir="auto"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="לדוגמה: ספק אלומיניום"
                className={isDeliveries ? 'bg-white/80' : undefined}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600" htmlFor={`qe-${orderId}`}>
                אימייל
              </label>
              <Input
                id={`qe-${orderId}`}
                dir="ltr"
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="supplier@example.com"
                className={isDeliveries ? 'bg-white/80' : undefined}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
            <Checkbox
              checked={saveToQuickList}
              onCheckedChange={(v) => setSaveToQuickList(v)}
            />
            שמור ברשימת ספקים מהירים (לפי אימייל)
          </label>

          <Button
            type="button"
            size="sm"
            disabled={sendingManual || Boolean(sendingKey)}
            className={cn(
              'inline-flex w-full items-center justify-center gap-2 sm:w-auto',
              isDeliveries && 'rounded-[14px] bg-[#0f172a] text-white hover:bg-[#1e293b]'
            )}
            onClick={() => void sendManualSupplier()}
          >
            {sendingManual ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 shrink-0 opacity-90" />
            )}
            שלח פריטי הזמנה לספק
          </Button>
        </div>
      ) : null}
    </div>
  );
}
