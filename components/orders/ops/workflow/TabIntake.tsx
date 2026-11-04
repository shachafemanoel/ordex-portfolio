import React from 'react';
import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { Button } from '@/components/ui/Button';
import { Package, Truck, CheckCircle2, ShoppingCart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpsItem, IntakeDecision } from './types';
import { getItemStateLabel } from './utils';

interface TabIntakeProps {
  items: OpsItem[];
  decisions: Record<string, IntakeDecision>;
  setDecisions: React.Dispatch<React.SetStateAction<Record<string, IntakeDecision>>>;
  onSubmit: () => void;
  isProcessing: boolean;
}

export default function TabIntake({
  items,
  decisions,
  setDecisions,
  onSubmit,
  isProcessing,
}: TabIntakeProps) {
  const applyBulkDecision = (decision: IntakeDecision) => {
    const bulk: Record<string, IntakeDecision> = {};
    for (const item of items) {
      bulk[item.id] = decision;
    }
    setDecisions(bulk);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">בדיקת מלאי</h3>
        <span className="text-xs text-slate-500">החלטה מהירה לכל פריט: מחסן או רכש</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          variant="outline"
          className="h-10 touch-manipulation border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700"
          onClick={() => applyBulkDecision('STOCK')}
        >
          סמן הכל זמין
        </Button>
        <Button
          variant="outline"
          className="h-10 touch-manipulation border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700"
          onClick={() => applyBulkDecision('PO')}
        >
          סמן הכל לרכש
        </Button>
        <Button
          variant="outline"
          className="h-10 touch-manipulation"
          onClick={() => setDecisions({})}
        >
          נקה בחירות
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const decision = decisions[item.id];
          const state = getItemStateLabel(item);
          const receivedPct =
            item.quantity > 0
              ? Math.min(100, Math.round((item.receivedQuantity / item.quantity) * 100))
              : 0;
          return (
            <div
              key={item.id}
              className={cn(
                'rounded-xl border bg-white p-3 transition-colors',
                decision === 'STOCK'
                  ? 'border-teal-200'
                  : decision === 'PO'
                    ? 'border-amber-200'
                    : 'border-slate-200'
              )}
            >
              {/* Item header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Package className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-slate-400 font-mono">{item.sku}</span>
                      <span className="text-xs text-slate-500">כמות: {item.quantity}</span>
                      {item.supplierName && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {item.supplierName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <EntityBadge
                  label={state.label}
                  tone={
                    state.variant === 'success'
                      ? 'success'
                      : state.variant === 'warning'
                        ? 'warning'
                        : 'info'
                  }
                  size="sm"
                  className="flex-shrink-0"
                />
              </div>

              {/* Received progress (if any) */}
              {item.receivedQuantity > 0 && (
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        receivedPct >= 100 ? 'bg-green-500' : 'bg-teal-400'
                      )}
                      style={{ width: `${receivedPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {item.receivedQuantity}/{item.quantity} התקבל
                  </span>
                </div>
              )}

              {/* Decision buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDecisions((p) => ({ ...p, [item.id]: 'STOCK' }))}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm transition flex items-center justify-center gap-1.5',
                    decision === 'STOCK'
                      ? 'border-emerald-200 bg-emerald-50 text-[#008c39] font-medium'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  זמין לאספקה
                </button>
                <button
                  type="button"
                  onClick={() => setDecisions((p) => ({ ...p, [item.id]: 'PO' }))}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm transition flex items-center justify-center gap-1.5',
                    decision === 'PO'
                      ? 'border-[#ffd9bf] bg-[#fff6ed] text-[#d45f00] font-medium'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  דורש רכש
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <Button onClick={onSubmit} disabled={isProcessing}>
          {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
          שמור קליטה
        </Button>
      </div>
    </div>
  );
}
