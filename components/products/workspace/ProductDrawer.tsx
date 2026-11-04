'use client';

import React from 'react';
import { AlertTriangle, Boxes, RefreshCcw, Save } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/Sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/Textarea';
import { ProductRecord, ProcurementType, ProductStatus, SalesChannelStatus } from '@/components/products/workspace/types';

interface ProductDrawerProps {
  product: ProductRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (product: ProductRecord) => void;
}

type DrawerTab = 'OVERVIEW' | 'INVENTORY' | 'PRICING' | 'CHANNELS' | 'MOVEMENTS';

const tabItems: Array<{ key: DrawerTab; label: string }> = [
  { key: 'OVERVIEW', label: 'סקירה' },
  { key: 'INVENTORY', label: 'מלאי ורכש' },
  { key: 'PRICING', label: 'מחירים ומס' },
  { key: 'CHANNELS', label: 'ערוצי מכירה' },
  { key: 'MOVEMENTS', label: 'תנועות מלאי' },
];

const statusBadgeVariant: Record<ProductStatus, 'success' | 'warning' | 'secondary'> = {
  ACTIVE: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'secondary',
};

const channelLabel = {
  ONLINE: 'אונליין',
  OFFLINE: 'אופליין',
  WOOCOMMERCE: 'WooCommerce',
} as const;

const syncLabel = {
  SYNCED: 'מסונכרן',
  PENDING: 'ממתין',
  FAILED: 'נכשל',
} as const;

const procurementLabel: Record<ProcurementType, string> = {
  INVENTORY: 'מלאי מקומי',
  DROPSHIP: 'אספקה חיצונית',
  SPECIAL_ORDER: 'הזמנה מיוחדת',
};

function formatDate(value: string | null): string {
  if (!value) return 'מעולם לא';
  return new Date(value).toLocaleString('he-IL');
}

function formatMoney(value: number | null, currency: ProductRecord['currency']): string {
  if (value === null) return 'ללא מחיר';
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function getStatusLabel(status: ProductStatus): string {
  if (status === 'ACTIVE') return 'פעיל';
  if (status === 'DRAFT') return 'טיוטה';
  return 'ארכיון';
}

export function ProductDrawer({ product, open, onOpenChange, onSave }: ProductDrawerProps) {
  const [activeTab, setActiveTab] = React.useState<DrawerTab>('OVERVIEW');
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [draft, setDraft] = React.useState<ProductRecord | null>(product);

  React.useEffect(() => {
    setDraft(product);
    setIsEditMode(false);
    setActiveTab('OVERVIEW');
  }, [product]);

  const baseSnapshot = React.useMemo(() => JSON.stringify(product ?? null), [product]);
  const draftSnapshot = React.useMemo(() => JSON.stringify(draft ?? null), [draft]);
  const hasChanges = baseSnapshot !== draftSnapshot;

  const saveDraft = React.useCallback(() => {
    if (!draft) return;
    onSave({ ...draft, updatedAt: new Date().toISOString() });
    setIsEditMode(false);
  }, [draft, onSave]);

  React.useEffect(() => {
    if (!open || !isEditMode || !hasChanges) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveDraft();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isEditMode, hasChanges, saveDraft]);

  if (!draft) return null;

  const syncedChannelsCount = draft.channels.filter(
    (channel) => channel.enabled && channel.syncState === 'SYNCED'
  ).length;
  const hasImage = Boolean(draft.imageUrl);
  const hasSku = Boolean(draft.sku.trim());
  const hasPrice = draft.price !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[98vw] max-w-[860px] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <SheetHeader className="space-y-3 text-right">
            <div className="flex flex-wrap items-start justify-between gap-3 pl-8">
              <div className="space-y-2">
                <SheetTitle className="text-2xl font-extrabold leading-tight text-slate-900">
                  {draft.name}
                </SheetTitle>
                <SheetDescription className="text-sm text-slate-500">
                  {draft.sku || 'ללא מק״ט'} • עודכן: {formatDate(draft.updatedAt)}
                </SheetDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant[draft.status]}>{getStatusLabel(draft.status)}</Badge>
                  <Badge variant="outline">{procurementLabel[draft.procurementType]}</Badge>
                  {hasChanges && <Badge variant="warning">טיוטה לא נשמרה</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDraft(product);
                        setIsEditMode(false);
                      }}
                    >
                      ביטול
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveDraft}
                      disabled={!hasChanges}
                      icon={<Save className="h-4 w-4" />}
                    >
                      שמירת שינויים
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setIsEditMode(true)}>
                    עריכת מוצר
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <KpiTile label="מחיר" value={formatMoney(draft.price, draft.currency)} />
            <KpiTile label="זמין במלאי" value={`${draft.stock}`} tone={draft.stock <= draft.lowStockThreshold ? 'warning' : 'success'} />
            <KpiTile label="ערוצים מסונכרנים" value={`${syncedChannelsCount}/${draft.channels.length}`} />
            <KpiTile label="חוסרים" value={`${Number(!hasImage) + Number(!hasPrice) + Number(!hasSku)}`} tone="warning" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {tabItems.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  activeTab === tab.key
                    ? 'bg-primary-500 text-on-dark'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5 p-5">
          {activeTab === 'OVERVIEW' && (
            <section className="space-y-4">
              {!hasImage || !hasPrice || !hasSku ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    נדרשת השלמת נתונים למוצר
                  </div>
                  <p className="mt-1">
                    {!hasImage ? 'חסרה תמונה. ' : ''}
                    {!hasPrice ? 'חסר מחיר. ' : ''}
                    {!hasSku ? 'חסר מק״ט.' : ''}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-500">תמונה ראשית</p>
                  <div className="h-48 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {draft.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.imageUrl} alt={draft.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        ללא תמונה
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-500">פרטי ליבה</p>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="mb-1 text-xs text-slate-500">שם מוצר</p>
                      <Input
                        value={draft.name}
                        disabled={!isEditMode}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-slate-500">מק״ט</p>
                      <Input
                        value={draft.sku}
                        disabled={!isEditMode}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, sku: e.target.value } : prev))}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-slate-500">ברקוד</p>
                      <Input
                        value={draft.barcode}
                        disabled={!isEditMode}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, barcode: e.target.value } : prev))}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-slate-500">תיאור קצר</p>
                      <Textarea
                        rows={2}
                        value={draft.shortDescription}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, shortDescription: e.target.value } : prev))
                        }
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-slate-500">תיאור מלא</p>
                      <Textarea
                        rows={3}
                        value={draft.description}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draft.tags.map((tag) => (
                        <Badge key={tag} variant="info">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'INVENTORY' && (
            <section className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-xs font-semibold uppercase text-slate-500">מלאי לפי מיקום / מחסן</p>
                <div className="space-y-2">
                  {draft.inventoryByLocation.map((location) => (
                    <div
                      key={location.id}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm md:grid-cols-4"
                    >
                      <p className="font-semibold">{location.locationName}</p>
                      <p>זמין: {location.available}</p>
                      <p>שמור: {location.reserved}</p>
                      <p>נק׳ הזמנה: {location.reorderPoint}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs text-slate-500">סטטוס מוצר</p>
                  <Select
                    value={draft.status}
                    disabled={!isEditMode}
                    onValueChange={(value) =>
                      setDraft((prev) => (prev ? { ...prev, status: value as ProductStatus } : prev))
                    }
                    options={[
                      { value: 'ACTIVE', label: 'פעיל' },
                      { value: 'DRAFT', label: 'טיוטה' },
                      { value: 'ARCHIVED', label: 'ארכיון' },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">סוג אספקה</p>
                  <Select
                    value={draft.procurementType}
                    disabled={!isEditMode}
                    onValueChange={(value) =>
                      setDraft((prev) => (prev ? { ...prev, procurementType: value as ProcurementType } : prev))
                    }
                    options={[
                      { value: 'INVENTORY', label: 'מלאי מקומי' },
                      { value: 'DROPSHIP', label: 'אספקה חיצונית' },
                      { value: 'SPECIAL_ORDER', label: 'הזמנה מיוחדת' },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">מלאי זמין</p>
                  <Input
                    type="number"
                    value={draft.stock}
                    disabled={!isEditMode || draft.procurementType !== 'INVENTORY'}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, stock: Number.parseInt(e.target.value || '0', 10) } : prev
                      )
                    }
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">כמות להזמנה חוזרת</p>
                  <Input
                    type="number"
                    value={draft.lowStockThreshold}
                    disabled={!isEditMode}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, lowStockThreshold: Number.parseInt(e.target.value || '0', 10) } : prev
                      )
                    }
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">מק״ט ספק</p>
                  <Input
                    value={draft.supplierSku ?? ''}
                    disabled={!isEditMode}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, supplierSku: e.target.value } : prev))}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">כמות מינימום (MOQ)</p>
                  <Input
                    type="number"
                    value={draft.moq ?? 0}
                    disabled={!isEditMode}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, moq: Number.parseInt(e.target.value || '0', 10) } : prev
                      )
                    }
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">מחיר עלות</p>
                  <Input
                    type="number"
                    value={draft.costPrice ?? 0}
                    disabled={!isEditMode}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, costPrice: Number.parseFloat(e.target.value || '0') } : prev
                      )
                    }
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">ימי אספקה</p>
                  <Input
                    type="number"
                    value={draft.leadTimeDays ?? 0}
                    disabled={!isEditMode}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, leadTimeDays: Number.parseInt(e.target.value || '0', 10) } : prev
                      )
                    }
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === 'PRICING' && (
            <section className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs text-slate-500">מחיר בסיס</p>
                  <Input
                    type="number"
                    value={draft.price ?? 0}
                    disabled={!isEditMode}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, price: Number.parseFloat(e.target.value || '0') } : prev
                      )
                    }
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">מטבע</p>
                  <Select
                    value={draft.currency}
                    disabled={!isEditMode}
                    onValueChange={(value) =>
                      setDraft((prev) =>
                        prev ? { ...prev, currency: value as ProductRecord['currency'] } : prev
                      )
                    }
                    options={[
                      { label: 'ILS', value: 'ILS' },
                      { label: 'USD', value: 'USD' },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">מחלקת מס</p>
                  <Input
                    value={draft.taxClass ?? ''}
                    disabled={!isEditMode}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, taxClass: e.target.value } : prev))}
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === 'CHANNELS' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-700">סנכרון ערוצים</p>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<RefreshCcw className="h-4 w-4" />}
                  onClick={() =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            channels: prev.channels.map((entry) => ({
                              ...entry,
                              syncState: entry.enabled ? 'SYNCED' : 'PENDING',
                              lastSyncedAt: entry.enabled ? new Date().toISOString() : entry.lastSyncedAt,
                            })),
                          }
                        : prev
                    )
                  }
                >
                  סנכרון כל הערוצים
                </Button>
              </div>

              {draft.channels.map((channel) => (
                <ChannelRow
                  key={channel.channel}
                  channel={channel}
                  disabled={!isEditMode}
                  onToggle={(enabled) =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            channels: prev.channels.map((entry) =>
                              entry.channel === channel.channel ? { ...entry, enabled } : entry
                            ),
                          }
                        : prev
                    )
                  }
                  onSync={() =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            channels: prev.channels.map((entry) =>
                              entry.channel === channel.channel
                                ? {
                                    ...entry,
                                    syncState: 'SYNCED',
                                    lastSyncedAt: new Date().toISOString(),
                                  }
                                : entry
                            ),
                          }
                        : prev
                    )
                  }
                />
              ))}
            </section>
          )}

          {activeTab === 'MOVEMENTS' && (
            <section className="rounded-xl border border-slate-200">
              {draft.stockMovements.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                  <Boxes className="h-8 w-8 text-slate-400" />
                  <p className="font-semibold text-slate-700">אין תנועות מלאי להצגה</p>
                  <p className="text-sm text-slate-500">תנועות חדשות יופיעו כאן אחרי קליטה או התאמת מלאי.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-right">סוג</th>
                      <th className="px-3 py-2 text-right">כמות</th>
                      <th className="px-3 py-2 text-right">סיבה</th>
                      <th className="px-3 py-2 text-right">תאריך</th>
                      <th className="px-3 py-2 text-right">משתמש</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.stockMovements.map((movement) => (
                      <tr key={movement.id} className="border-b border-slate-100">
                        <td className="px-3 py-2">{movement.type}</td>
                        <td className="px-3 py-2">{movement.quantity}</td>
                        <td className="px-3 py-2">{movement.reason}</td>
                        <td className="px-3 py-2">{formatDate(movement.createdAt)}</td>
                        <td className="px-3 py-2">{movement.updatedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function KpiTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function ChannelRow({
  channel,
  disabled,
  onToggle,
  onSync,
}: {
  channel: SalesChannelStatus;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  onSync: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
      <div>
        <p className="font-semibold text-slate-900">{channelLabel[channel.channel]}</p>
        <p className="text-xs text-slate-500">סנכרון אחרון: {formatDate(channel.lastSyncedAt)}</p>
      </div>
      <div className="flex items-center gap-3">
        <Badge
          variant={
            channel.syncState === 'SYNCED'
              ? 'success'
              : channel.syncState === 'PENDING'
              ? 'warning'
              : 'destructive'
          }
        >
          {syncLabel[channel.syncState]}
        </Badge>
        <Switch
          checked={channel.enabled}
          disabled={disabled}
          onCheckedChange={onToggle}
          aria-label={`הפעלת פרסום עבור ${channelLabel[channel.channel]}`}
        />
        <Button size="sm" variant="outline" onClick={onSync}>
          סנכרן עכשיו
        </Button>
      </div>
    </div>
  );
}
