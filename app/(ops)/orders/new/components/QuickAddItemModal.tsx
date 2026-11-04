'use client';

import { DisplaySemanticBadge } from '@/components/ui/display-templates';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface QuickAddItemData {
  name: string;
  sku?: string;
  productId?: string;
  basePriceCents?: number | null;
  stock?: number;
  supplierId?: string | null;
  supplierName?: string | null;
  inventoryEnabled?: boolean;
  procurementRequired?: boolean;
  serialNumberType?: 'NONE' | 'AUTO' | 'MANUAL';
  basketItemId?: string; // New field for editing
  quantity?: number;
  remarks?: string;
}

interface QuickAddItemModalProps {
  isOpen: boolean;
  item: QuickAddItemData | null;
  onClose: () => void;
  onAdd: (data: {
    quantity: number;
    priceCents: number;
    supplierId?: string;
    remarks?: string;
    inventoryEnabled?: boolean;
    procurementRequired?: boolean;
    serialNumberType?: 'NONE' | 'AUTO' | 'MANUAL';
  }) => void;
  // Callback when item name is updated (for custom items)
  onUpdateName?: (name: string) => void;
  suppliers?: Array<{ id: string; name: string }>;
}

export function QuickAddItemModal({
  isOpen,
  item,
  onClose,
  onAdd,
  onUpdateName,
  suppliers = [],
}: QuickAddItemModalProps) {
  const { t, direction } = useUITranslation();
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [name, setName] = useState('');
  const [isCustomItem, setIsCustomItem] = useState(false);
  const [inventoryEnabled, setInventoryEnabled] = useState(true);
  const [procurementRequired, setProcurementRequired] = useState(false);
  const [serialNumberType, setSerialNumberType] = useState<'NONE' | 'AUTO' | 'MANUAL'>('NONE');

  const quantityRef = useRef<HTMLInputElement>(null);

  // Reset and pre-fill when modal opens
  useEffect(() => {
    if (isOpen && item) {
      setQuantity('1');
      setRemarks('');
      setName(item.name || '');
      setIsCustomItem(!item.productId && !item.name); // If no productId and no name, it's a new custom item being created

      // Pre-fill price if available (convert from cents to shekels)
      if (item.basePriceCents !== null && item.basePriceCents !== undefined) {
        setPrice((item.basePriceCents / 100).toString());
      } else {
        setPrice('');
      }

      // Pre-select supplier if available
      if (item.supplierId && suppliers.some((s) => s.id === item.supplierId)) {
        setSupplierId(item.supplierId);
      } else {
        setSupplierId('');
      }

      setInventoryEnabled(item.inventoryEnabled ?? true);
      setProcurementRequired(item.procurementRequired ?? false);
      setSerialNumberType(item.serialNumberType ?? 'NONE');
      setQuantity(item.quantity?.toString() ?? '1');
      setRemarks(item.remarks ?? '');
      setFormError(null);

      // Focus quantity field
      setTimeout(() => quantityRef.current?.focus(), 100);
    }
  }, [isOpen, item, suppliers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const qty = parseInt(quantity);
    const priceInShekels = parseFloat(price);

    if (isNaN(qty) || qty <= 0) {
      setFormError(t('orders.new.quickAdd.error.invalidQuantity'));
      return;
    }

    if (isNaN(priceInShekels) || priceInShekels <= 0) {
      setFormError(t('orders.new.quickAdd.error.invalidPrice'));
      return;
    }

    const priceCents = Math.round(priceInShekels * 100);
    if (priceCents <= 0) {
      setFormError(t('orders.new.quickAdd.error.invalidPrice'));
      return;
    }

    setFormError(null);

    onAdd({
      quantity: qty,
      priceCents,
      supplierId: supplierId || undefined,
      remarks: remarks.trim() || undefined,
      inventoryEnabled,
      procurementRequired,
      serialNumberType,
    });

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir={direction}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md mx-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-subtle">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-fg">
              {item.name || t('orders.new.quickAdd.title')}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {item.sku && (
                <p className="text-sm text-fg-muted">
                  {t('orders.new.quickAdd.skuPrefix', undefined, { params: { sku: item.sku } })}
                </p>
              )}
              {item.stock !== undefined && (
                <DisplaySemanticBadge
                  tone={
                    item.stock <= 0 ? 'danger' : item.stock < 10 ? 'warning' : 'success'
                  }
                  className="text-xs font-medium"
                >
                  {t('orders.new.quickAdd.stock', undefined, { params: { count: item.stock } })}
                </DisplaySemanticBadge>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5 text-fg-subtle" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Custom Item Name Input */}
          {isCustomItem && (
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">
                {t('orders.new.quickAdd.customName')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (onUpdateName) onUpdateName(e.target.value);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-subtle focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                  placeholder={t('orders.new.quickAdd.customNamePlaceholder')}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Quantity and Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quick-quantity" className="text-sm font-medium mb-2">
                {t('orders.new.quickAdd.quantity')}
              </Label>
              <Input
                ref={quantityRef}
                id="quick-quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="text-center text-lg font-semibold"
                required
              />
            </div>
            <div>
              <Label htmlFor="quick-price" className="text-sm font-medium mb-2">
                {t('orders.new.quickAdd.unitPrice')}
              </Label>
              <Input
                id="quick-price"
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="text-center text-lg font-semibold"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {formError && (
            <div className="surface-danger-soft rounded-lg px-3 py-2 text-sm font-medium">
              {formError}
            </div>
          )}

          {/* Supplier (Optional) */}
          {suppliers.length > 0 && (
            <div>
              <Label htmlFor="quick-supplier" className="text-sm font-medium mb-2">
                {t('orders.new.quickAdd.supplierOptional')}
              </Label>
              <select
                id="quick-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-subtle rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="">{t('orders.new.quickAdd.noSupplier')}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Remarks (Optional) */}
          <div>
            <Label htmlFor="quick-remarks" className="text-sm font-medium mb-2">
              {t('orders.new.quickAdd.remarksOptional')}
            </Label>
            <Input
              id="quick-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={t('orders.new.quickAdd.remarksPlaceholder')}
              className="text-sm"
            />
          </div>

          {/* Product Management Options */}
          <div className="space-y-3 p-4 bg-surface-muted rounded-xl border border-subtle">
            <h4 className="text-xs font-bold text-fg-subtle uppercase tracking-wider">
              {t('orders.new.quickAdd.management.title')}
            </h4>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={inventoryEnabled}
                    onChange={(e) => setInventoryEnabled(e.target.checked)}
                    className="w-5 h-5 rounded border-subtle text-primary focus:ring-primary/20 transition-all cursor-pointer"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-fg-muted group-hover:text-primary transition-colors">
                    {t('orders.new.quickAdd.management.inventory')}
                  </span>
                  <span className="text-[10px] text-fg-muted">
                    {t('orders.new.quickAdd.management.inventoryHint')}
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={procurementRequired}
                  onChange={(e) => setProcurementRequired(e.target.checked)}
                  className="w-5 h-5 rounded border-subtle text-primary focus:ring-primary/20 transition-all cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-fg-muted group-hover:text-primary transition-colors">
                    {t('orders.new.quickAdd.management.procurement')}
                  </span>
                  <span className="text-[10px] text-fg-muted">
                    {t('orders.new.quickAdd.management.procurementHint')}
                  </span>
                </div>
              </label>
            </div>

            <div className="mt-2 pt-3 border-t border-subtle">
              <Label className="text-xs font-semibold text-fg-muted mb-1.5 block">
                {t('orders.new.quickAdd.management.serial')}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(['NONE', 'AUTO', 'MANUAL'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSerialNumberType(type)}
                    className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      serialNumberType === type
                        ? 'bg-primary-50 border-primary-200 text-primary-700 ring-2 ring-primary-100'
                        : 'bg-surface border-subtle text-fg-muted hover:border-subtle-light'
                    }`}
                  >
                    {type === 'NONE'
                      ? t('orders.new.quickAdd.management.serial.none')
                      : type === 'AUTO'
                        ? t('orders.new.quickAdd.management.serial.auto')
                        : t('orders.new.quickAdd.management.serial.manual')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1 bg-primary-600 hover:bg-primary-700 text-on-dark">
              {t('orders.new.quickAdd.addToBasket')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
