'use client';

import { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OrderModalStepHeader } from '@/components/orders/shared/OrderModalStepHeader';
import { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Minus, Package, Plus } from 'lucide-react';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Order;
  onConfirm: (payload: any) => Promise<void>;
  title?: string;
  description?: string;
}

interface ReceiptItem {
  id: string;
  name: string;
  sku: string;
  qty: number;
  receivedQuantity: number;
  newReceived: number;
}

export function GoodsReceiptModal({
  isOpen,
  onClose,
  entity,
  onConfirm,
  title,
  description,
}: GoodsReceiptModalProps) {
  const [items, setItems] = useState<ReceiptItem[]>(() =>
    (entity.items || []).map((item) => ({
      id: item.id,
      name: item.name || (item as any).sku || 'פריט ללא שם',
      sku: (item as any).sku || '',
      qty: (item as any).quantity ?? 0,
      receivedQuantity: (item as any).receivedQuantity ?? 0,
      newReceived: (item as any).receivedQuantity ?? 0,
    }))
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const totals = useMemo(() => {
    const totalOrdered = items.reduce((s, i) => s + i.qty, 0);
    const totalReceived = items.reduce((s, i) => s + i.newReceived, 0);
    const fullyReceived = items.filter((i) => i.newReceived >= i.qty).length;
    return { totalOrdered, totalReceived, fullyReceived };
  }, [items]);

  const overallPct =
    totals.totalOrdered > 0
      ? Math.min(100, Math.round((totals.totalReceived / totals.totalOrdered) * 100))
      : 0;

  const handleMarkAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, newReceived: i.qty })));
  };

  const handleClearAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, newReceived: 0 })));
  };

  const setItemReceived = (idx: number, value: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, newReceived: Math.max(0, Math.min(item.qty, value)) }
          : item
      )
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        items: items.map((i) => ({
          id: i.id,
          receivedQuantity: i.newReceived,
          received: i.newReceived >= i.qty,
        })),
      };
      await onConfirm(payload);
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'קבלת סחורה'} maxWidth="lg">
      <div className="space-y-4" dir="rtl">
        {/* Step context – receiving goods is the PROCESSING step */}
        <OrderModalStepHeader
          currentStatus="PROCESSING"
          targetStatus="READY"
          description="קליטת מלאי מלאה תאפשר להעביר את ההזמנה לשלב 'מוכן'"
        />

        {description && <p className="text-sm text-gray-500">{description}</p>}

        {/* Overall progress bar */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              התקבלו {totals.fullyReceived} מתוך {items.length} פריטים
            </span>
            <span className="font-bold text-slate-900">{overallPct}%</span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                overallPct >= 100 ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        {/* Bulk actions – touch-optimized */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs border-slate-200 touch-manipulation"
            onClick={handleMarkAll}
            disabled={isSubmitting}
          >
            <CheckCircle2 className="h-4 w-4 ml-1 text-green-600" />
            סמן הכל כהתקבל
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs border-slate-200 touch-manipulation"
            onClick={handleClearAll}
            disabled={isSubmitting}
          >
            <Clock className="h-4 w-4 ml-1 text-slate-400" />
            אפס הכל
          </Button>
        </div>

        {/* Item list – momentum scroll on touch */}
        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 touch-scroll auto-scrollbar">
          {items.map((item, idx) => {
            const itemPct =
              item.qty > 0
                ? Math.min(100, Math.round((item.newReceived / item.qty) * 100))
                : 0;
            const done = item.newReceived >= item.qty;

            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-xl border p-3 transition-colors',
                  done ? 'border-green-200 bg-green-50/50' : 'border-slate-200 bg-white'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      done ? 'bg-green-100' : 'bg-slate-100'
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Package className="h-5 w-5 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 leading-tight">
                          {item.name}
                        </p>
                        {item.sku && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{item.sku}</p>
                        )}
                      </div>

                      {/* Quantity stepper – touch-optimized (44px min targets) */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setItemReceived(idx, item.newReceived - 1)}
                          disabled={item.newReceived <= 0 || isSubmitting}
                          className="h-10 w-10 md:h-8 md:w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors touch-manipulation active:scale-90"
                        >
                          <Minus className="h-4 w-4 md:h-3.5 md:w-3.5" />
                        </button>
                        <Input
                          type="number"
                          value={item.newReceived}
                          onChange={(e) => setItemReceived(idx, parseInt(e.target.value) || 0)}
                          min={0}
                          max={item.qty}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="h-10 md:h-8 w-16 text-center text-sm px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          disabled={isSubmitting}
                        />
                        <button
                          type="button"
                          onClick={() => setItemReceived(idx, item.newReceived + 1)}
                          disabled={item.newReceived >= item.qty || isSubmitting}
                          className="h-10 w-10 md:h-8 md:w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors touch-manipulation active:scale-90"
                        >
                          <Plus className="h-4 w-4 md:h-3.5 md:w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Per-item progress */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            done ? 'bg-green-500' : 'bg-blue-400'
                          )}
                          style={{ width: `${itemPct}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          'text-xs whitespace-nowrap font-medium',
                          done ? 'text-green-600' : 'text-slate-500'
                        )}
                      >
                        {item.newReceived} / {item.qty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer – full-width stacked on mobile */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} size="lg" className="w-full sm:w-auto sm:h-10">
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || overallPct === 0} size="lg" className="w-full sm:w-auto sm:h-10">
            {isSubmitting ? 'שומר…' : 'שמור קבלת סחורה'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
