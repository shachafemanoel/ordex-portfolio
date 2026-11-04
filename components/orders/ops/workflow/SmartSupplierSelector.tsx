import React from 'react';
import { Check, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EntityBadge,
  EntityField,
  EntitySurface,
} from '@/components/shared/display/EntityPrimitives';
import { SupplierOption } from './types';

// Extended type for the smart selector (mocking extra fields for now if not present in API)
export interface SmartSupplierOption extends SupplierOption {
  price?: number;
  etaDays?: number;
  moq?: number;
  rating?: number;
  isRecommended?: boolean;
}

interface SmartSupplierSelectorProps {
  suppliers: SmartSupplierOption[];
  selectedSupplierId: string | null;
  onSelect: (supplierId: string) => void;
}

export function SmartSupplierSelector({ suppliers, selectedSupplierId, onSelect }: SmartSupplierSelectorProps) {
  // If no extended data, we might want to generate some or just show basic info
  // For this UX upgrade, let's assume we want to show the "Smart" UI even with basic data

  const recommended = suppliers.find(s => s.isRecommended) || suppliers[0];
  const others = suppliers.filter(s => s.id !== recommended?.id);

  if (suppliers.length === 0) return <div className="text-sm text-slate-500">אין ספקים זמינים</div>;

  return (
    <div className="space-y-4">
      {recommended && (
        <EntitySurface className="relative overflow-hidden border-emerald-200 bg-[linear-gradient(180deg,#ffffff_0%,#f3fff7_100%)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900">{recommended.name}</h4>
                <EntityBadge label="מומלץ" tone="success" size="sm" />
                {recommended.rating && (
                  <div className="flex text-amber-400">
                    <Star className="h-3 w-3 fill-current" />
                    <span className="text-xs text-slate-600 mr-1">{recommended.rating}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <EntityField label="מחיר ליח׳" value={`₪${(recommended.price || 120).toFixed(2)}`} />
                <EntityField label="אספקה" value={`${recommended.etaDays || 2} ימים`} tone="info" />
                <EntityField label="מינימום" value={`${recommended.moq || 10} יח׳`} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelect(recommended.id)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border transition-all',
                selectedSupplierId === recommended.id
                  ? 'border-emerald-600 bg-emerald-600 text-on-dark shadow-md scale-110'
                  : 'border-slate-200 bg-white text-slate-300 hover:border-emerald-500 hover:text-emerald-500'
              )}
            >
              <Check className="h-5 w-5" />
            </button>
          </div>
        </EntitySurface>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">אפשרויות נוספות</p>
          {others.map((supplier) => (
            <div
              key={supplier.id}
              onClick={() => onSelect(supplier.id)}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-[18px] border bg-white p-3 transition-all hover:border-slate-300',
                selectedSupplierId === supplier.id
                  ? 'border-primary-100 bg-primary-50'
                  : 'border-slate-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">
                  {supplier.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{supplier.name}</p>
                  <p className="text-[10px] text-slate-500">
                    ₪{(supplier.price || 135).toFixed(0)} • {(supplier.etaDays || 5)} ימים
                  </p>
                </div>
              </div>

              {selectedSupplierId === supplier.id && (
                <EntityBadge label="נבחר" tone="info" size="sm" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
