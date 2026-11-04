/**
 * ItemEditor Component
 *
 * Standalone order items editor with full Prisma schema support.
 * Allows adding, editing, and removing order items with automatic calculations.
 *
 * Features:
 * - ProductAutocomplete for product search and selection
 * - Dynamic item list (add/edit/remove)
 * - Automatic total calculation
 * - VAT category support
 * - Supplier selection
 * - RTL support
 * - Responsive layout
 */

'use client';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  ProductAutocomplete,
  type ProductSearchResult,
} from '@/components/orders/shared/ProductAutocomplete';
import { cn } from '@/lib/utils';
import type { VatCategory } from '@prisma/client';
import { Minus, Package, Pencil, Plus, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface OrderItem {
  /** Temporary ID for tracking (not saved to DB) */
  _tempId?: string;

  /** Product/SKU ID (UUID) */
  productId: string;

  /** SKU code */
  sku: string;

  /** Item name */
  name: string;

  /** Quantity */
  qty: number;

  /** Unit price in cents */
  priceCents: number;

  /** Tax rate (optional, e.g., 0.17 for 17%) */
  taxRate?: number;

  /** VAT category */
  vatCategory: VatCategory;

  /** Total price in cents (calculated) */
  totalCents: number;

  /** Description (optional) */
  description?: string;

  /** Supplier ID (optional) */
  supplierId?: string;
}

export interface ItemEditorProps {
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
  currency?: string;
  disabled?: boolean;
  className?: string;
  /** Optional supplier context for product search */
  supplierId?: string;
  supplierName?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function displayToCents(display: string): number {
  const num = parseFloat(display);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

function calculateItemTotal(qty: number, priceCents: number): number {
  return qty * priceCents;
}

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const EMPTY_ITEM: Partial<OrderItem> = {
  sku: '',
  name: '',
  qty: 1,
  priceCents: 0,
  taxRate: 0.17,
  vatCategory: 'STANDARD' as VatCategory,
  description: '',
  totalCents: 0,
};

// ============================================================================
// COMPONENT
// ============================================================================

export const ItemEditor: React.FC<ItemEditorProps> = ({
  items,
  onChange,
  currency = '₪',
  disabled = false,
  className,
  supplierId,
  supplierName,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<Partial<OrderItem>>(EMPTY_ITEM);
  const [useProductSearch, setUseProductSearch] = useState(true);

  const isFormOpen = isAddingNew || editingIndex !== null;

  // Recalculate total when qty/price changes
  useEffect(() => {
    if (isFormOpen) {
      const total = calculateItemTotal(newItem.qty || 0, newItem.priceCents || 0);
      setNewItem((prev) => ({ ...prev, totalCents: total }));
    }
  }, [newItem.qty, newItem.priceCents, isFormOpen]);

  // ─── Product autocomplete handler ───
  const handleProductSelect = (product: ProductSearchResult) => {
    const priceCents = product.salePriceCents ?? product.basePriceCents ?? 0;
    setNewItem((prev) => ({
      ...prev,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      priceCents,
      supplierId: product.supplierId ?? prev.supplierId,
      totalCents: calculateItemTotal(prev.qty ?? 1, priceCents),
    }));
  };

  const handleAddItem = () => {
    if (!newItem.name || !newItem.sku || (newItem.qty || 0) <= 0) return;

    const itemToAdd: OrderItem = {
      _tempId: generateTempId(),
      productId: newItem.productId || generateTempId(),
      sku: newItem.sku!,
      name: newItem.name!,
      qty: newItem.qty || 1,
      priceCents: newItem.priceCents || 0,
      taxRate: newItem.taxRate,
      vatCategory: newItem.vatCategory || 'STANDARD',
      totalCents: newItem.totalCents || 0,
      description: newItem.description,
      supplierId: newItem.supplierId,
    };

    onChange([...items, itemToAdd]);
    setNewItem(EMPTY_ITEM);
    setIsAddingNew(false);
  };

  const handleEditItem = (index: number) => {
    setNewItem(items[index]);
    setEditingIndex(index);
    setIsAddingNew(false);
    setUseProductSearch(false); // Show manual fields when editing
  };

  const handleUpdateItem = () => {
    if (editingIndex === null) return;

    const updatedItems = [...items];
    updatedItems[editingIndex] = {
      ...updatedItems[editingIndex],
      ...newItem,
    } as OrderItem;

    onChange(updatedItems);
    setEditingIndex(null);
    setNewItem(EMPTY_ITEM);
  };

  const handleRemoveItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleCancelEdit = () => {
    setIsAddingNew(false);
    setEditingIndex(null);
    setNewItem(EMPTY_ITEM);
    setUseProductSearch(true);
  };

  const grandTotal = items.reduce((sum, item) => sum + item.totalCents, 0);

  return (
    <div className={cn('space-y-4', className)} dir="rtl">

      {/* ─── Items list ─── */}
      {items.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    מק״ט
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    שם הפריט
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    כמות
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    מחיר יח׳
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    מע״מ
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    סה״כ
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr key={item._tempId || index} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-slate-500">{item.sku}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-slate-400 mt-0.5">{item.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-slate-700">{item.qty}</td>
                    <td className="px-4 py-3 text-sm text-slate-700" dir="ltr">
                      {currency}
                      {centsToDisplay(item.priceCents)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {item.taxRate ? `${(item.taxRate * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900" dir="ltr">
                      {currency}
                      {centsToDisplay(item.totalCents)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditItem(index)}
                          disabled={disabled}
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
                          title="ערוך"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          disabled={disabled}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                          title="מחק"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {items.map((item, index) => (
              <div key={item._tempId || index} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-900 text-sm whitespace-nowrap" dir="ltr">
                    {currency}
                    {centsToDisplay(item.totalCents)}
                  </span>
                </div>

                {item.description && (
                  <p className="text-xs text-slate-500">{item.description}</p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    כמות {item.qty} × {currency}
                    {centsToDisplay(item.priceCents)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditItem(index)}
                      disabled={disabled}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={disabled}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Grand total */}
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-between items-center font-semibold">
            <span className="text-slate-700">סה״כ כולל מע״מ:</span>
            <span className="text-base text-slate-900" dir="ltr">
              {currency}
              {centsToDisplay(grandTotal)}
            </span>
          </div>
        </div>
      )}

      {/* ─── Add / Edit form ─── */}
      {isFormOpen && (
        <div className="border border-slate-200 rounded-xl bg-slate-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">
              {editingIndex !== null ? 'עריכת פריט' : 'הוספת פריט חדש'}
            </h3>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Product search (only for new items) */}
          {editingIndex === null && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseProductSearch(true)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border transition-colors',
                    useProductSearch
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  )}
                >
                  חיפוש מוצר
                </button>
                <button
                  type="button"
                  onClick={() => setUseProductSearch(false)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border transition-colors',
                    !useProductSearch
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  )}
                >
                  הזנה ידנית
                </button>
              </div>

              {useProductSearch && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    חפש מוצר
                  </label>
                  <ProductAutocomplete
                    supplierId={supplierId}
                    supplierName={supplierName}
                    onSelect={handleProductSelect}
                    placeholder="הקלד שם מוצר או מק״ט…"
                    selectedProductName={newItem.name}
                    disabled={disabled}
                  />
                  {newItem.name && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
                      <Package className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{newItem.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{newItem.sku}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual fields (always shown when !useProductSearch, or for editing) */}
          {(!useProductSearch || editingIndex !== null) && (
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="מק״ט" required>
                <Input
                  value={newItem.sku || ''}
                  onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                  placeholder="מק״ט"
                  disabled={disabled}
                />
              </FormField>

              <FormField label="שם הפריט" required>
                <Input
                  value={newItem.name || ''}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="שם המוצר"
                  disabled={disabled}
                />
              </FormField>
            </div>
          )}

          {/* Quantity + price + VAT */}
          <div className="grid gap-3 md:grid-cols-3">
            {/* Quantity with stepper */}
            <FormField label="כמות" required>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setNewItem({ ...newItem, qty: Math.max(1, (newItem.qty || 1) - 1) })
                  }
                  disabled={disabled || (newItem.qty || 1) <= 1}
                  className="h-10 w-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex-shrink-0 transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <Input
                  type="number"
                  min="1"
                  value={newItem.qty || 1}
                  onChange={(e) =>
                    setNewItem({ ...newItem, qty: parseInt(e.target.value) || 1 })
                  }
                  disabled={disabled}
                  className="text-center flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setNewItem({ ...newItem, qty: (newItem.qty || 1) + 1 })
                  }
                  disabled={disabled}
                  className="h-10 w-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex-shrink-0 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </FormField>

            <FormField label={`מחיר יח׳ (כולל מע״מ)`} required>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={centsToDisplay(newItem.priceCents || 0)}
                onChange={(e) =>
                  setNewItem({ ...newItem, priceCents: displayToCents(e.target.value) })
                }
                disabled={disabled}
                dir="ltr"
              />
            </FormField>

            <FormField label="מע״מ (%)">
              <Input
                type="number"
                step="1"
                min="0"
                max="100"
                value={((newItem.taxRate || 0) * 100).toFixed(0)}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    taxRate: parseFloat(e.target.value) / 100 || 0,
                  })
                }
                disabled={disabled}
              />
            </FormField>
          </div>

          <FormField label="קטגוריית מע״מ">
            <Select
              value={newItem.vatCategory || 'STANDARD'}
              onChange={(e) =>
                setNewItem({ ...newItem, vatCategory: e.target.value as VatCategory })
              }
              disabled={disabled}
            >
              <option value="STANDARD">רגיל</option>
              <option value="REDUCED">מופחת</option>
              <option value="ZERO">אפס</option>
              <option value="EXEMPT">פטור</option>
            </Select>
          </FormField>

          <FormField label="תיאור">
            <Input
              value={newItem.description || ''}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              placeholder="תיאור נוסף (אופציונלי)"
              disabled={disabled}
            />
          </FormField>

          {/* Total preview */}
          <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-sm font-medium text-slate-700">סה״כ כולל מע״מ:</span>
            <span className="text-base font-semibold text-slate-900" dir="ltr">
              {currency}
              {centsToDisplay(newItem.totalCents || 0)}
            </span>
          </div>

          {/* Form actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={handleCancelEdit} disabled={disabled}>
              ביטול
            </Button>
            <Button
              type="button"
              onClick={editingIndex !== null ? handleUpdateItem : handleAddItem}
              disabled={disabled || !newItem.name || !newItem.sku || (newItem.qty || 0) <= 0}
            >
              {editingIndex !== null ? 'עדכן פריט' : 'הוסף פריט'}
            </Button>
          </div>
        </div>
      )}

      {/* ─── Add button ─── */}
      {!isFormOpen && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsAddingNew(true);
            setUseProductSearch(true);
          }}
          disabled={disabled}
          className="w-full border-dashed border-slate-300 text-slate-600 hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-4 w-4 ml-2" />
          הוסף פריט
        </Button>
      )}
    </div>
  );
};

export default ItemEditor;
