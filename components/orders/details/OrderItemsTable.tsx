'use client';

import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { getEntityToneDotClass } from '@/components/shared/display/displayStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Package,
  Plus,
  Truck,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────

type ItemStatus = 'PENDING' | 'ORDERED' | 'RECEIVED' | 'INSTALLED' | 'CANCELLED' | string;
type AllocationStatus = 'PENDING' | 'ALLOCATED' | 'OUT_OF_STOCK' | 'ON_ORDER' | string;

interface OrderItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  image?: string;
  status?: ItemStatus;
  receivedQuantity?: number;
  allocationStatus?: AllocationStatus;
  supplierName?: string;
}

interface OrderItemsTableProps {
  items: OrderItem[];
  currency?: string;
  onAddItem?: () => void;
  onUpdateItem?: (itemId: string, data: { status?: string }) => Promise<void>;
  checklistMode?: boolean;
  checkedItems?: Record<string, boolean>;
  onCheckItem?: (itemId: string, checked: boolean) => void;
}

// ─── Status Helpers ───────────────────────────────────────────────

const ITEM_STATUS_META: Record<
  string,
  { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' }
> = {
  PENDING: {
    label: 'ממתין',
    tone: 'neutral',
  },
  ORDERED: {
    label: 'הוזמן',
    tone: 'info',
  },
  RECEIVED: {
    label: 'התקבל',
    tone: 'success',
  },
  INSTALLED: {
    label: 'הותקן',
    tone: 'success',
  },
  CANCELLED: {
    label: 'בוטל',
    tone: 'warning',
  },
};

const ALLOCATION_STATUS_META: Record<
  string,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' }
> = {
  PENDING: { label: 'לא שויך', tone: 'neutral' },
  ALLOCATED: { label: 'במחסן', tone: 'success' },
  OUT_OF_STOCK: { label: 'אזל המלאי', tone: 'warning' },
  ON_ORDER: { label: 'בהזמנת רכש', tone: 'info' },
};

function ItemStatusBadge({ status }: { status?: ItemStatus }) {
  const key = status || 'PENDING';
  const meta = ITEM_STATUS_META[key] ?? {
    label: key,
    tone: 'neutral' as const,
  };

  return (
    <EntityBadge
      label={meta.label}
      tone={meta.tone}
      dotClassName={getEntityToneDotClass(meta.tone)}
      className="gap-1 px-2 py-0.5 text-xs font-medium tracking-tight"
    />
  );
}

function AllocationBadge({ status }: { status?: AllocationStatus }) {
  if (!status || status === 'PENDING') return null;
  const meta = ALLOCATION_STATUS_META[status] ?? {
    label: status,
    tone: 'neutral' as const,
  };
  return (
    <EntityBadge
      label={meta.label}
      tone={meta.tone}
      dotClassName={getEntityToneDotClass(meta.tone)}
      className="px-1.5 py-0.5 text-[10px] font-medium tracking-tight"
    />
  );
}

function ReceivedProgress({
  received,
  total,
}: {
  received: number;
  total: number;
}) {
  if (total === 0 || received === 0) return null;
  const pct = Math.min(100, Math.round((received / total) * 100));
  const done = received >= total;
  return (
    <div className="flex flex-col gap-1 mt-1.5">
      <div className="flex items-center justify-between text-[10px] font-bold">
        <span className={cn(done ? 'text-emerald-600' : 'text-primary-600')}>
          {received}/{total}
        </span>
        <span className="text-slate-400 opacity-60 uppercase tracking-tighter">התקבל</span>
      </div>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', done ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-primary-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function OrderItemsTable({
  items,
  currency = 'ILS',
  onAddItem,
  onUpdateItem,
  checklistMode = false,
  checkedItems = {},
  onCheckItem,
}: OrderItemsTableProps) {
  const [showVatInclusive, setShowVatInclusive] = useState(true);

  const total = items.reduce((sum, item) => {
    const price =
      typeof item.totalPrice === 'number' && !isNaN(item.totalPrice) ? item.totalPrice : 0;
    return sum + price;
  }, 0);

  // Extract the VAT component (prices already include VAT)
  const vat = total > 0 ? Math.round(total - total / 1.18) : 0;
  const subtotal = total - vat;

  return (
    <Card className="border border-slate-100 shadow-ordex-md rounded-2xl overflow-hidden bg-white h-full">
      <CardHeader className="border-b border-slate-50 px-6 py-5 bg-slate-50/50 flex flex-row items-center justify-between">
        <CardTitle className="text-heading-md text-slate-900 flex items-center gap-2">
          {checklistMode ? 'אישור פריטים' : 'תוכן ההזמנה'}
          <span className="text-caption text-slate-400 font-bold tracking-widest uppercase">({items.length} פריטים)</span>
        </CardTitle>

        {!checklistMode && onAddItem && (
          <div className="flex items-center gap-3">
            {/* VAT toggle */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <span className="text-xs font-medium text-slate-500">מחיר כולל מע״מ</span>
              <button
                onClick={() => setShowVatInclusive(!showVatInclusive)}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                  showVatInclusive ? 'bg-primary' : 'bg-slate-300'
                )}
                aria-checked={showVatInclusive}
                role="switch"
              >
                <span
                  className={cn(
                    'inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform duration-200',
                    showVatInclusive ? 'translate-x-5' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onAddItem}
              className="text-primary hover:bg-primary/5"
            >
              <Plus className="h-4 w-4 ml-2" />
              הוסף פריט
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50 text-slate-500">
              <tr className="text-right">
                {checklistMode && <th className="px-4 py-4 w-[50px]" />}
                <th className="px-6 py-4 font-medium w-[35%]">פריט</th>
                <th className="px-3 py-4 font-medium text-center">סטטוס</th>
                <th className="px-4 py-4 font-medium text-center">כמות</th>
                {!checklistMode && <th className="px-4 py-4 font-medium">ספק</th>}
                {!checklistMode && <th className="px-4 py-4 font-medium text-left">מחיר יח׳</th>}
                {!checklistMode && <th className="px-6 py-4 font-medium text-left">סה״כ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    'group transition-colors',
                    checklistMode && checkedItems[item.id]
                      ? 'bg-green-50/50'
                      : 'hover:bg-slate-50/30'
                  )}
                  onClick={() =>
                    checklistMode && onCheckItem?.(item.id, !checkedItems[item.id])
                  }
                  style={{ cursor: checklistMode ? 'pointer' : 'default' }}
                >
                  {checklistMode && (
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!!checkedItems[item.id]}
                        onCheckedChange={(checked) =>
                          onCheckItem?.(item.id, checked as boolean)
                        }
                      />
                    </td>
                  )}

                  {/* Product cell */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center border border-slate-200 overflow-hidden">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={44}
                            height={44}
                            className="object-cover h-full w-full"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-900 truncate">{item.name}</span>
                        <span className="text-xs text-slate-400 font-mono mt-0.5">{item.sku}</span>
                        {item.receivedQuantity !== undefined && item.receivedQuantity > 0 && (
                          <ReceivedProgress
                            received={item.receivedQuantity}
                            total={item.quantity}
                          />
                        )}
                        {item.allocationStatus && item.allocationStatus !== 'PENDING' && (
                          <div className="mt-1">
                            <AllocationBadge status={item.allocationStatus} />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Status cell */}
                  <td className="px-3 py-4 text-center">
                    {!checklistMode && onUpdateItem ? (
                      <select
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={item.status || 'PENDING'}
                        onChange={(e) => onUpdateItem(item.id, { status: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="PENDING">ממתין</option>
                        <option value="ORDERED">הוזמן</option>
                        <option value="RECEIVED">התקבל</option>
                        <option value="INSTALLED">הותקן</option>
                        <option value="CANCELLED">בוטל</option>
                      </select>
                    ) : (
                      <ItemStatusBadge status={item.status} />
                    )}
                  </td>

                  {/* Quantity */}
                  <td className="px-4 py-4 text-center font-medium text-slate-700">
                    {item.quantity}
                  </td>

                  {!checklistMode && (
                    <>
                      {/* Supplier */}
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {item.supplierName ? (
                          <span className="inline-flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {item.supplierName}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Unit price */}
                      <td className="px-4 py-4 text-slate-600 text-left" dir="ltr">
                        {formatCurrency(
                          showVatInclusive
                            ? item.unitPrice
                            : Math.round(item.unitPrice / 1.18)
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-6 py-4 font-bold text-slate-900 text-left" dir="ltr">
                        {formatCurrency(
                          showVatInclusive
                            ? item.totalPrice
                            : Math.round(item.totalPrice / 1.18)
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-slate-100">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'p-4 transition-colors',
                checklistMode && checkedItems[item.id] ? 'bg-green-50' : 'hover:bg-slate-50'
              )}
              onClick={() =>
                checklistMode && onCheckItem?.(item.id, !checkedItems[item.id])
              }
            >
              <div className="flex items-start gap-3">
                {checklistMode && (
                  <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={!!checkedItems[item.id]}
                      onCheckedChange={(checked) =>
                        onCheckItem?.(item.id, checked as boolean)
                      }
                    />
                  </div>
                )}

                <div className="h-10 w-10 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center border border-slate-200 overflow-hidden">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={40}
                      height={40}
                      className="object-cover h-full w-full"
                    />
                  ) : (
                    <Package className="h-4 w-4 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{item.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                    </div>
                    {!checklistMode && (
                      <span className="text-sm font-bold text-slate-900 whitespace-nowrap" dir="ltr">
                        {formatCurrency(showVatInclusive ? item.totalPrice : Math.round(item.totalPrice / 1.18))}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <ItemStatusBadge status={item.status} />
                    <AllocationBadge status={item.allocationStatus} />
                    <span className="text-xs text-slate-500">כמות: {item.quantity}</span>
                    {item.supplierName && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Truck className="h-3 w-3" /> {item.supplierName}
                      </span>
                    )}
                  </div>

                  {item.receivedQuantity !== undefined && item.receivedQuantity > 0 && (
                    <div className="mt-2">
                      <ReceivedProgress received={item.receivedQuantity} total={item.quantity} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        {!checklistMode && (
          <div className="bg-slate-50/30 border-t border-slate-100 px-6 py-6 space-y-3">
            <div className="flex justify-between text-caption font-bold text-slate-400 uppercase tracking-widest">
              <span>סה״כ לפני מע״מ:</span>
              <span dir="ltr">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-caption font-bold text-slate-400 uppercase tracking-widest">
              <span>מע״מ כלול (18%):</span>
              <span dir="ltr">{formatCurrency(vat)}</span>
            </div>
            <div className="flex justify-between items-center surface-dark rounded-xl px-4 py-4 mt-4 shadow-ordex-md">
              <span className="text-body-strong text-on-dark-muted uppercase tracking-wider">סה״כ לתשלום:</span>
              <span className="text-heading-lg text-on-dark" dir="ltr">{formatCurrency(total)}</span>
            </div>
          </div>
        )}

        {/* Add item bottom link */}
        {!checklistMode && onAddItem && (
          <div className="px-6 py-4 border-t border-slate-100 bg-white">
            <button
              className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline"
              onClick={onAddItem}
            >
              <Plus className="h-4 w-4" />
              הוספת פריט להזמנה
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
