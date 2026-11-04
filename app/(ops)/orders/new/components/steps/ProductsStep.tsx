'use client';

import { useOrderWizard } from '@/app/(ops)/orders/new/components/OrderWizardContext';
import {
  QuickAddItemModal,
  type QuickAddItemData,
} from '@/app/(ops)/orders/new/components/QuickAddItemModal';
import { StepChecklist } from '@/app/(ops)/orders/new/components/StepChecklist';
import {
  ProductAutocomplete,
  type ProductSearchResult,
} from '@/components/orders/shared/ProductAutocomplete';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { useSuppliersQuery } from '@/lib/hooks/api/suppliers/useSuppliersQuery';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { getEffectivePrice } from '@/lib/pricing';
import { formatCurrencyCents } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Edit2,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

const AVATAR_BG_VARS = [
  'var(--color-primary-100)',
  'var(--tone-success-border)',
  'var(--tone-warning-border)',
  'color-mix(in srgb, var(--color-danger-500) 12%, var(--color-surface-muted))',
  'color-mix(in srgb, var(--color-primary-500) 14%, var(--color-surface-muted))',
  'var(--tone-accent-border)',
] as const;
const AVATAR_FG_VARS = [
  'var(--color-primary-700)',
  'var(--color-success-700)',
  'var(--color-warning-700)',
  'var(--color-danger-700)',
  'var(--color-primary-800)',
  'var(--color-accent-600)',
] as const;

/** Letter-based avatar for products without images (mirrors ProductAutocomplete) */
function ProductItemAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const letter = (name || '?').charAt(0).toUpperCase();
  const idx = (name.charCodeAt(0) || 0) % AVATAR_BG_VARS.length;

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className="h-14 w-14 rounded-lg object-cover border border-subtle"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div
      className="h-14 w-14 rounded-lg flex items-center justify-center text-xl font-bold shrink-0 border border-subtle"
      style={{ backgroundColor: AVATAR_BG_VARS[idx], color: AVATAR_FG_VARS[idx] }}
    >
      {letter}
    </div>
  );
}

export function ProductsStep() {
  const { state, addItem, updateItem, removeItem, goNext, goBack, totalCents } = useOrderWizard();
  const toast = useToast();
  const { t, direction } = useUITranslation();

  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuickAddItemData | null>(null);

  const handleProductSelect = (product: ProductSearchResult) => {
    // Check if already in list
    const existing = state.items.find((item) => item.productId === product.id);
    if (existing) {
      if (existing.priceCents <= 0) {
        handleEditItem(existing);
        toast.warning(t('orders.new.products.toast.updatePriceBeforeQty'));
        return;
      }
      updateItem(existing.id, { quantity: existing.quantity + 1 });
      return;
    }

    // Use effective price (sale price if promo is active)
    const { priceCents, wasOnSale, originalPriceCents } = getEffectivePrice({
      basePriceCents: product.basePriceCents,
      salePriceCents: product.salePriceCents ?? null,
      promoStartsAt: product.promoStartsAt ? new Date(product.promoStartsAt) : null,
      promoEndsAt: product.promoEndsAt ? new Date(product.promoEndsAt) : null,
    });

    if (priceCents <= 0) {
      setEditingItem({
        name: product.name,
        sku: product.sku,
        productId: product.id,
        basePriceCents: product.basePriceCents,
        stock: product.stock,
        supplierId: product.supplierId,
        supplierName: product.supplierName,
        inventoryEnabled: product.inventoryEnabled,
        procurementRequired: product.procurementRequired,
        serialNumberType: product.serialNumberType,
        quantity: 1,
      });
      setIsQuickAddModalOpen(true);
      toast.warning(t('orders.new.products.toast.noPrice'));
      return;
    }

    addItem({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      productImageUrl: product.imageUrl ?? null,
      quantity: 1,
      priceCents,
      inventoryEnabled: product.inventoryEnabled,
      procurementRequired: product.procurementRequired,
      serialNumberType: product.serialNumberType,
      wasOnSale,
      originalPriceCents,
    });
    toast.success(
      wasOnSale ? t('orders.new.products.toast.addedSale') : t('orders.new.products.toast.added')
    );
  };

  const handleAddCustomItem = () => {
    setEditingItem({
      name: '',
      stock: 0,
    });
    setIsQuickAddModalOpen(true);
  };

  const handleEditItem = (item: ReturnType<typeof useOrderWizard>['state']['items'][0]) => {
    setEditingItem({
      basketItemId: item.id,
      productId: item.productId,
      name: item.productName,
      sku: item.productSku,
      basePriceCents: item.priceCents,
      supplierId: item.supplierId,
      inventoryEnabled: item.inventoryEnabled,
      procurementRequired: item.procurementRequired,
      serialNumberType: item.serialNumberType,
      quantity: item.quantity,
      remarks: item.remarks,
    });
    setIsQuickAddModalOpen(true);
  };

  const handleQuickAddSubmit = (data: {
    quantity: number;
    priceCents: number;
    supplierId?: string;
    remarks?: string;
    inventoryEnabled?: boolean;
    procurementRequired?: boolean;
    serialNumberType?: 'NONE' | 'AUTO' | 'MANUAL';
  }) => {
    if (!editingItem) return;
    if (data.priceCents <= 0) {
      toast.error(t('orders.new.products.toast.invalidPrice'));
      return;
    }

    if (editingItem.basketItemId) {
      // It's an update
      updateItem(editingItem.basketItemId, {
        quantity: data.quantity,
        priceCents: data.priceCents,
        supplierId: data.supplierId,
        remarks: data.remarks,
        inventoryEnabled: data.inventoryEnabled,
        procurementRequired: data.procurementRequired,
        serialNumberType: data.serialNumberType,
      });
      toast.success(t('orders.new.products.toast.updated'));
    } else {
      // It's a new item
      addItem({
        productId: editingItem.productId, // undefined for custom items
        productName: editingItem.name || t('orders.new.products.fallbackGenericItem'),
        productSku: editingItem.sku || `TEMP-${Date.now()}`,
        quantity: data.quantity,
        priceCents: data.priceCents,
        supplierId: data.supplierId,
        remarks: data.remarks,
        inventoryEnabled: data.inventoryEnabled,
        procurementRequired: data.procurementRequired,
        serialNumberType: data.serialNumberType,
      });
      toast.success(t('orders.new.products.toast.addedOrder'));
    }

    setEditingItem(null);
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      removeItem(itemId);
    } else {
      updateItem(itemId, { quantity: newQty });
    }
  };

  const invalidPricedItems = state.items.filter((item) => item.priceCents <= 0).length;
  const canProceed = state.items.length > 0 && invalidPricedItems === 0;

  const checklistItems = [
    {
      id: 'has-items',
      label: t('orders.new.products.checklist.hasItems'),
      done: state.items.length > 0,
    },
    {
      id: 'valid-prices',
      label: t('orders.new.products.checklist.validPrices'),
      done: invalidPricedItems === 0 && state.items.length > 0,
    },
    {
      id: 'quantities',
      label: t('orders.new.products.checklist.validQty'),
      done: state.items.every((item) => item.quantity > 0),
    },
  ];

  const handleNextStep = () => {
    if (state.items.length === 0) {
      toast.warning(t('orders.new.products.toast.needAtLeastOne'));
      return;
    }
    if (invalidPricedItems > 0) {
      toast.warning(t('orders.new.products.toast.needValidPrices'));
      return;
    }
    goNext();
  };

  // Fetch suppliers for the modal
  const { data: suppliersData } = useSuppliersQuery({ page: 1, limit: 100 });
  const suppliers = suppliersData?.items || [];

  return (
    <div className="space-y-5 sm:space-y-7 animate-in fade-in duration-500" dir={direction}>
      <StepChecklist
        title={t('orders.new.products.checklist.title')}
        items={checklistItems}
        className="bg-surface"
      />

      <section className="bg-surface rounded-xl border border-subtle shadow-lg ring-1 ring-primary/5 overflow-hidden">
        <div className="p-6 border-b border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-4 items-center">
            <div className="size-10 rounded-full bg-primary text-on-dark flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined">shopping_cart</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-fg">
                {t('orders.new.products.sectionTitle')}
              </h3>
              <p className="text-sm text-fg-muted">{t('orders.new.products.sectionSubtitle')}</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <ProductAutocomplete
                onSelect={handleProductSelect}
                placeholder={t('orders.new.products.searchPlaceholder')}
                className="bg-surface-muted border-subtle rounded-lg text-sm"
              />
            </div>
            <Button
              onClick={handleAddCustomItem}
              variant="outline"
              className="whitespace-nowrap gap-2 border-dashed border-subtle-light hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              {t('orders.new.products.addGeneric')}
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 grid gap-3 sm:gap-4">
          {state.items.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-fg-subtle mb-4">
                <span className="material-symbols-outlined text-6xl">inventory_2</span>
              </div>
              <p className="text-fg-muted font-medium">{t('orders.new.products.empty')}</p>
              <Button
                onClick={handleAddCustomItem}
                variant="link"
                className="mt-2 text-primary hover:underline"
              >
                + {t('orders.new.products.addGeneric')}
              </Button>
            </div>
          ) : (
            state.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-subtle hover:border-primary-600/30 hover:bg-primary-50/30 transition-all group bg-surface"
              >
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <ProductItemAvatar name={item.productName} imageUrl={item.productImageUrl} />
                    {!item.productId && (
                      <div className="absolute -top-1 -right-1 bg-status-amber-bg text-status-amber-text text-[9px] px-1 py-0.5 rounded font-bold leading-tight">
                        {t('orders.new.products.tempTag')}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-fg text-base leading-tight group-hover:text-primary-600 transition-colors">
                      {item.productName}
                    </h4>
                    <p className="text-xs text-fg-muted font-mono mt-0.5">{item.productSku}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <p className="font-bold text-fg text-sm">
                        {formatCurrencyCents(item.priceCents)}
                      </p>
                      {item.priceCents <= 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full surface-danger-soft px-2 py-0.5 text-[10px] font-bold">
                          <AlertTriangle className="h-3 w-3" />
                          {t('orders.new.products.missingPrice')}
                        </span>
                      )}
                      {item.wasOnSale && item.originalPriceCents && (
                        <p className="text-xs text-fg-subtle line-through">
                          {formatCurrencyCents(item.originalPriceCents)}
                        </p>
                      )}
                      {item.wasOnSale && (
                        <span className="bg-status-red-bg text-status-red-text text-[10px] px-1.5 rounded-full font-bold">
                          {t('orders.new.products.saleTag')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <div className="flex items-center bg-surface-muted rounded-lg border border-subtle p-1">
                    <button
                      onClick={() => handleUpdateQty(item.id, -1)}
                      className="size-8 flex items-center justify-center rounded-md hover:bg-surface hover:text-danger text-fg-subtle transition-colors"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="w-4 h-4" />
                      ) : (
                        <Minus className="w-4 h-4" />
                      )}
                    </button>
                    <span className="w-8 text-center font-bold text-fg text-sm">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQty(item.id, 1)}
                      className="size-8 flex items-center justify-center rounded-md hover:bg-surface hover:text-success text-fg-muted transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleEditItem(item)}
                    className="size-10 flex items-center justify-center rounded-lg border border-transparent hover:border-subtle hover:bg-surface text-fg-subtle hover:text-primary-600 transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Sticky Footer for Actions — z-[1032] to appear above mobile bottom nav (z-1030) */}
      <div className="fixed bottom-0 left-0 right-0 z-[1032] bg-surface-translucent-strong backdrop-blur-md border-t border-subtle p-3 sm:p-4">
        <div className="max-w-[960px] mx-auto flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <Button
            variant="ghost"
            onClick={goBack}
            className="font-bold text-fg-muted gap-2 w-full sm:w-auto"
          >
            <ArrowRight className="w-5 h-5" />
            <span>{t('common.back')}</span>
          </Button>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-surface px-3 py-2 sm:px-4 sm:py-2.5">
            <div>
              <p className="text-xs text-fg-muted">{t('orders.new.products.total')}</p>
              <p className="text-sm sm:text-base font-bold text-fg">
                {formatCurrencyCents(totalCents)}
              </p>
              {invalidPricedItems > 0 && (
                <p className="text-[11px] font-semibold text-danger">
                  {t('orders.new.products.invalidItemsCount', undefined, {
                    params: { count: invalidPricedItems },
                  })}
                </p>
              )}
            </div>
            <Button
              onClick={handleNextStep}
              disabled={!canProceed}
              className="h-11 rounded-lg bg-primary-600 text-on-dark font-bold hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all flex items-center gap-2 px-4 sm:px-6"
            >
              <span>{t('orders.new.step.summary')}</span>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
      <div className="h-20" />

      {/* Quick Add Modal */}
      <QuickAddItemModal
        isOpen={isQuickAddModalOpen}
        item={editingItem}
        onClose={() => setIsQuickAddModalOpen(false)}
        onAdd={handleQuickAddSubmit}
        suppliers={suppliers.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
