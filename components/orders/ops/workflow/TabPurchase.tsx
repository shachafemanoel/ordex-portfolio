import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { OpsItem, SupplierOption } from './types';
import { buildDateOnlyShortcut } from './utils';
import { SmartSupplierSelector, SmartSupplierOption } from './SmartSupplierSelector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TabPurchaseProps {
  items: OpsItem[];
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  supplierOptions: SupplierOption[];
  suppliersLoading: boolean;
  supplierByItemId: Record<string, string>;
  setSupplierForItem: (itemId: string, supplierId: string) => void;
  expectedDate: string;
  setExpectedDate: (v: string) => void;
  supplierDetails: string;
  setSupplierDetails: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
}

export default function TabPurchase({
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
  isProcessing,
}: TabPurchaseProps) {

  // State for smart selector modal
  const [smartSelectorItemId, setSmartSelectorItemId] = useState<string | null>(null);

  const projectedPurchaseOrderCount = useMemo(() => {
    const selectedSupplierIds = new Set<string>();
    for (const item of items) {
      if (!selectedIds.includes(item.id)) continue;
      const supplierId = supplierByItemId[item.id] || item.supplierId || '';
      if (supplierId) {
        selectedSupplierIds.add(supplierId);
      }
    }
    return selectedSupplierIds.size;
  }, [items, selectedIds, supplierByItemId]);

  const chooseItemsMissingSupplier = () => {
    const onlyMissingSupplier = items
      .filter((item) => {
        const supplierId = supplierByItemId[item.id] || item.supplierId || '';
        return !supplierId;
      })
      .map((item) => item.id);
    setSelectedIds(onlyMissingSupplier);
  };

  // Mock extended supplier data for the smart selector
  const getSmartSuppliers = (itemId: string): SmartSupplierOption[] => {
    // In a real app, this would come from an API based on the item
    // For now we enrich the existing simple options
    return supplierOptions.map((s, idx) => ({
      ...s,
      price: 100 + (idx * 10) + (Math.random() * 20),
      etaDays: 2 + idx,
      moq: 10 * (idx + 1),
      rating: 5 - (idx * 0.5),
      isRecommended: idx === 0 // Recommend the first one
    }));
  };

  const handleSmartSelect = (supplierId: string) => {
    if (smartSelectorItemId) {
      setSupplierForItem(smartSelectorItemId, supplierId);
      setSmartSelectorItemId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">הזמנת רכש לספקים</h3>
        <span className="text-xs text-slate-500">
          {projectedPurchaseOrderCount > 0
            ? `צפי ל-${projectedPurchaseOrderCount} הזמנות רכש`
            : 'בחר ספקים לפריטים'}
        </span>
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
          onClick={chooseItemsMissingSupplier}
        >
          בחר ללא ספק
        </Button>
        <Button
          variant="outline"
          className="h-10 touch-manipulation"
          onClick={() => setSelectedIds([])}
        >
          נקה בחירה
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        {suppliersLoading ? (
          <div className="rounded-md bg-white px-3 py-2 text-xs text-slate-500">טוען ספקים…</div>
        ) : null}
        {items.map((item) => {
          const checked = selectedIds.includes(item.id);
          const selectedSupplierId = supplierByItemId[item.id] || item.supplierId || '';

          // Find selected supplier name for display
          const selectedSupplierName = supplierOptions.find(s => s.id === selectedSupplierId)?.name
                                      || (selectedSupplierId === item.supplierId ? item.supplierName : '')
                                      || 'בחר ספק';

          return (
            <div key={item.id} className="flex flex-col gap-2 rounded-md bg-white px-2 py-2">
              <div className="flex cursor-pointer items-center gap-2">
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
                <span className="text-sm text-slate-700">{item.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  כמות: {item.quantity}
                </Badge>
                {item.supplierName ? (
                  <Badge variant="outline" className="text-[10px]">
                    ספק: {item.supplierName}
                  </Badge>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[100px,1fr] sm:items-center">
                <span className="text-[11px] text-slate-500">שייך לספק</span>

                {/* Smart Selector Trigger Button instead of Select */}
                <button
                  type="button"
                  onClick={() => setSmartSelectorItemId(item.id)}
                  className="w-full text-right rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200 flex justify-between items-center hover:bg-slate-50"
                >
                  <span>{selectedSupplierName}</span>
                  <span className="text-teal-600 font-bold text-[10px]">שינוי</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">צפי קבלת מלאי</label>
          <input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setExpectedDate(buildDateOnlyShortcut(0))}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
            >
              היום
            </button>
            <button
              type="button"
              onClick={() => setExpectedDate(buildDateOnlyShortcut(1))}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
            >
              מחר
            </button>
            <button
              type="button"
              onClick={() => setExpectedDate(buildDateOnlyShortcut(3))}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
            >
              +3 ימים
            </button>
            <button
              type="button"
              onClick={() => setExpectedDate(buildDateOnlyShortcut(7))}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
            >
              +7 ימים
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">פרטי ספק</label>
          <input
            type="text"
            value={supplierDetails}
            onChange={(e) => setSupplierDetails(e.target.value)}
            placeholder="שם/טלפון/הערה"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">הערות רכש</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערות חופשיות למחלקת רכש"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
        />
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <Button onClick={onSubmit} disabled={isProcessing}>
          {isProcessing ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="ml-2 h-4 w-4" />
          )}
          צור הזמנת רכש
        </Button>
      </div>

      {/* Smart Supplier Selector Modal */}
      <Dialog open={!!smartSelectorItemId} onOpenChange={(open) => !open && setSmartSelectorItemId(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>בחירת ספק חכמה</DialogTitle>
          </DialogHeader>
          {smartSelectorItemId && (
            <SmartSupplierSelector
              suppliers={getSmartSuppliers(smartSelectorItemId)}
              selectedSupplierId={supplierByItemId[smartSelectorItemId] || items.find(i => i.id === smartSelectorItemId)?.supplierId || null}
              onSelect={handleSmartSelect}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
