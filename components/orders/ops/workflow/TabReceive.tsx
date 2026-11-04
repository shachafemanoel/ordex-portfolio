import React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpsItem } from './types';
import { getItemStateLabel } from './utils';

interface TabReceiveProps {
  items: OpsItem[];
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  onSubmit: () => void;
  isProcessing: boolean;
}

export default function TabReceive({
  items,
  selectedIds,
  setSelectedIds,
  onSubmit,
  isProcessing,
}: TabReceiveProps) {
  const onOrderItemIds = items
    .filter((item) => item.allocationStatus === 'ON_ORDER')
    .map((item) => item.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">קליטת מלאי למחסן</h3>
        <span className="text-xs text-slate-500">אשר במהירות פריטים שהגיעו בפועל</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          variant="outline"
          className="h-10 touch-manipulation"
          onClick={() => setSelectedIds(items.map((item) => item.id))}
        >
          בחר הכל
        </Button>
        <Button
          variant="outline"
          className="h-10 touch-manipulation"
          onClick={() => setSelectedIds(onOrderItemIds)}
        >
          בחר פריטי רכש
        </Button>
        <Button
          variant="outline"
          className="h-10 touch-manipulation"
          onClick={() => setSelectedIds([])}
        >
          נקה בחירה
        </Button>
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={selectedIds.length === items.length && items.length > 0}
          onChange={(e) => setSelectedIds(e.target.checked ? items.map((i) => i.id) : [])}
          className="h-4 w-4 rounded border-slate-300 text-teal-600"
        />
        סמן הכל
      </label>

      <div className="space-y-2">
        {items.map((item) => {
          const checked = selectedIds.includes(item.id);
          const state = getItemStateLabel(item);
          return (
            <label
              key={item.id}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-lg border bg-white px-3 py-2.5 transition',
                checked ? 'border-teal-300 bg-teal-50/60' : 'border-slate-200'
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSelectedIds((p) =>
                      p.includes(item.id) ? p.filter((id) => id !== item.id) : [...p, item.id]
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-teal-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    מק״ט: {item.sku} | כמות: {item.quantity}
                  </p>
                </div>
              </div>
              <Badge variant={state.variant} className="text-[10px]">
                {state.label}
              </Badge>
            </label>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <Button onClick={onSubmit} disabled={isProcessing}>
          {isProcessing ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="ml-2 h-4 w-4" />
          )}
          אשר סיום הכנה
        </Button>
      </div>
    </div>
  );
}
