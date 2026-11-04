'use client';

import React from 'react';
import { RowSelectionState } from '@tanstack/react-table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Filter } from 'lucide-react';
import { mapApiProductToRecord, mapProductRecordToUpdatePayload } from '@/components/products/workspace/dataProvider';
import { ProductDrawer } from '@/components/products/workspace/ProductDrawer';
import { ProductsKpiStrip, PRODUCTS_KPI_ICONS } from '@/components/products/workspace/ProductsKpiStrip';
import { ProductsTable } from '@/components/products/workspace/ProductsTable';
import {
  useProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
} from '@/lib/hooks/api/products';
import {
  ProductFiltersState,
  ProductIssue,
  ProductRecord,
  ProductStatus,
  ProcurementType,
  SalesChannelKey,
} from './types';

const initialFilters: ProductFiltersState = {
  tab: 'ALL',
  query: '',
  category: 'ALL',
  brand: 'ALL',
  supplier: 'ALL',
  procurementType: 'ALL',
  channel: 'ALL',
  showVariantsAsRows: true,
  quick: {
    lowStock: false,
    inactive: false,
    missingImage: false,
  },
  focusIssue: null,
};

function isLowStock(product: ProductRecord): boolean {
  return product.stock <= product.lowStockThreshold;
}

function hasMissingImage(product: ProductRecord): boolean {
  return !product.imageUrl;
}

function hasMissingPrice(product: ProductRecord): boolean {
  return product.price === null;
}

function hasMissingSku(product: ProductRecord): boolean {
  return !product.sku.trim();
}

function isNotSynced(product: ProductRecord): boolean {
  return product.channels.every((channel) => !channel.enabled || channel.syncState !== 'SYNCED');
}

export function ProductsWorkspace() {
  const [filters, setFilters] = React.useState<ProductFiltersState>(initialFilters);
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkStatus, setBulkStatus] = React.useState<ProductStatus>('ACTIVE');
  const [bulkProcurementType, setBulkProcurementType] = React.useState<ProcurementType>('INVENTORY');

  // ── Data via React Query ─────────────────────────────────────────────────────
  const { data, isLoading, error, refetch } = useProductsQuery({ limit: 500 });
  const products: ProductRecord[] = React.useMemo(
    () => (data?.items ?? []).map(mapApiProductToRecord),
    [data?.items]
  );

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useCreateProductMutation();
  const updateMutation = useUpdateProductMutation();

  // ── Derived data ─────────────────────────────────────────────────────────────
  const uniqueCategories = React.useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products]
  );
  const uniqueBrands = React.useMemo(
    () => Array.from(new Set(products.map((p) => p.brand))).sort(),
    [products]
  );
  const uniqueSuppliers = React.useMemo(
    () => Array.from(new Set(products.map((p) => p.supplier))).sort(),
    [products]
  );

  const baseFiltered = React.useMemo(() => {
    return products.filter((product) => {
      if (!filters.showVariantsAsRows && product.parentProductId) return false;
      if (filters.tab !== 'ALL' && product.status !== filters.tab) return false;
      if (filters.category !== 'ALL' && product.category !== filters.category) return false;
      if (filters.brand !== 'ALL' && product.brand !== filters.brand) return false;
      if (filters.supplier !== 'ALL' && product.supplier !== filters.supplier) return false;
      if (filters.procurementType !== 'ALL' && product.procurementType !== filters.procurementType) return false;
      if (
        filters.channel !== 'ALL' &&
        !product.channels.some((ch) => ch.channel === filters.channel && ch.enabled)
      ) {
        return false;
      }
      const query = filters.query.trim().toLowerCase();
      if (query) {
        const hit =
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          product.barcode.toLowerCase().includes(query);
        if (!hit) return false;
      }
      if (filters.quick.lowStock && !isLowStock(product)) return false;
      if (filters.quick.inactive && product.status === 'ACTIVE') return false;
      if (filters.quick.missingImage && !hasMissingImage(product)) return false;
      return true;
    });
  }, [filters, products]);

  const filteredProducts = React.useMemo(() => {
    if (!filters.focusIssue) return baseFiltered;
    return baseFiltered.filter((product) => {
      if (filters.focusIssue === 'LOW_STOCK') return isLowStock(product);
      if (filters.focusIssue === 'MISSING_IMAGE') return hasMissingImage(product);
      if (filters.focusIssue === 'MISSING_PRICE') return hasMissingPrice(product);
      if (filters.focusIssue === 'MISSING_SKU') return hasMissingSku(product);
      return isNotSynced(product);
    });
  }, [baseFiltered, filters.focusIssue]);

  const kpis = React.useMemo(
    () => [
      {
        issue: 'ACTIVE_PRODUCTS' as const,
        label: 'מוצרים פעילים',
        value: products.filter((p) => p.status === 'ACTIVE').length,
        icon: PRODUCTS_KPI_ICONS.ACTIVE_PRODUCTS,
      },
      {
        issue: 'LOW_STOCK' as ProductIssue,
        label: 'מלאי נמוך',
        value: products.filter(isLowStock).length,
        icon: PRODUCTS_KPI_ICONS.LOW_STOCK,
      },
      {
        issue: 'MISSING_PRICE' as ProductIssue,
        label: 'ללא מחיר',
        value: products.filter(hasMissingPrice).length,
        icon: PRODUCTS_KPI_ICONS.MISSING_PRICE,
      },
      {
        issue: 'NOT_SYNCED' as ProductIssue,
        label: 'לא מסונכרן',
        value: products.filter(isNotSynced).length,
        icon: PRODUCTS_KPI_ICONS.NOT_SYNCED,
      },
    ],
    [products]
  );

  const activeCount = products.filter((p) => p.status === 'ACTIVE').length;

  const selectedProduct = React.useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const selectedIds = React.useMemo(
    () => Object.entries(rowSelection).filter(([, selected]) => selected).map(([id]) => id),
    [rowSelection]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreateProduct = () => {
    const timestamp = Date.now();
    createMutation.mutate(
      {
        name: 'מוצר חדש',
        sku: `NEW-${timestamp.toString().slice(-5)}`,
        isActive: false,
      },
      {
        onSuccess: (product) => {
          if (product?.id) setSelectedProductId(product.id);
        },
      }
    );
  };

  const handleSave = (updated: ProductRecord) => {
    updateMutation.mutate({ id: updated.id, data: mapProductRecordToUpdatePayload(updated) });
  };

  const handleUpdateStock = (productId: string, stock: number) => {
    updateMutation.mutate({ id: productId, data: { demoStock: stock } });
  };

  const handleUpdatePrice = (productId: string, price: number) => {
    updateMutation.mutate({ id: productId, data: { basePriceCents: Math.round(price * 100) } });
  };

  const handleArchive = (productId: string) => {
    updateMutation.mutate({ id: productId, data: { isActive: false } });
  };

  const handleDuplicate = (productId: string) => {
    const source = products.find((p) => p.id === productId);
    if (!source) return;
    const timestamp = Date.now();
    createMutation.mutate(
      {
        name: `${source.name} (עותק)`,
        sku: `${source.sku || 'SKU'}-COPY-${timestamp.toString().slice(-4)}`,
        basePriceCents: source.price !== null ? Math.round(source.price * 100) : null,
        procurementType: source.procurementType,
        isActive: false,
      },
      {
        onSuccess: (product) => {
          if (product?.id) setSelectedProductId(product.id);
        },
      }
    );
  };

  const applyStatusToSelected = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach((id) =>
      updateMutation.mutate({ id, data: { isActive: bulkStatus === 'ACTIVE' } })
    );
    setRowSelection({});
  };

  const applyProcurementTypeToSelected = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach((id) =>
      updateMutation.mutate({ id, data: { procurementType: bulkProcurementType } })
    );
    setRowSelection({});
  };

  return (
    <div className="space-y-5" dir="rtl">
      <header className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900">ניהול מוצרים</h1>
            <Badge variant="info">{activeCount} פעילים</Badge>
          </div>
          <Button
            onClick={handleCreateProduct}
            icon={<Plus className="h-4 w-4" />}
            aria-label="יצירת מוצר חדש"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'יוצר...' : 'מוצר חדש'}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            שגיאה בטעינת מוצרים:{' '}
            {error instanceof Error ? error.message : 'אירעה שגיאה'}
            <button type="button" className="ml-2 underline" onClick={() => refetch()}>
              נסה שוב
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={filters.query}
              onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
              placeholder="חיפוש לפי שם, מק״ט או ברקוד"
              className="pl-9"
              aria-label="חיפוש מוצרים"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickChip
              active={filters.quick.lowStock}
              label="מלאי נמוך"
              onClick={() =>
                setFilters((prev) => ({ ...prev, quick: { ...prev.quick, lowStock: !prev.quick.lowStock } }))
              }
            />
            <QuickChip
              active={filters.quick.inactive}
              label="לא פעילים"
              onClick={() =>
                setFilters((prev) => ({ ...prev, quick: { ...prev.quick, inactive: !prev.quick.inactive } }))
              }
            />
            <QuickChip
              active={filters.quick.missingImage}
              label="ללא תמונה"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  quick: { ...prev.quick, missingImage: !prev.quick.missingImage },
                }))
              }
            />
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? 'טוען...' : 'רענון מלא'}
            </Button>
          </div>
        </div>
      </header>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, tab }))}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                filters.tab === tab
                  ? 'bg-primary-500 text-on-dark'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'ALL' ? 'הכל' : tab === 'ACTIVE' ? 'פעילים' : tab === 'DRAFT' ? 'טיוטות' : 'ארכיון'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <Select
            value={filters.category}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
            options={[
              { value: 'ALL', label: 'כל הקטגוריות' },
              ...uniqueCategories.map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            value={filters.brand}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, brand: value }))}
            options={[
              { value: 'ALL', label: 'כל המותגים' },
              ...uniqueBrands.map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            value={filters.supplier}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, supplier: value }))}
            options={[
              { value: 'ALL', label: 'כל הספקים' },
              ...uniqueSuppliers.map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            value={filters.procurementType}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                procurementType: value as ProductFiltersState['procurementType'],
              }))
            }
            options={[
              { value: 'ALL', label: 'כל סוגי האספקה' },
              { value: 'INVENTORY', label: 'מלאי מקומי' },
              { value: 'DROPSHIP', label: 'אספקה חיצונית' },
              { value: 'SPECIAL_ORDER', label: 'הזמנה מיוחדת' },
            ]}
          />
          <Select
            value={filters.channel}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, channel: value as 'ALL' | SalesChannelKey }))
            }
            options={[
              { value: 'ALL', label: 'כל הערוצים' },
              { value: 'ONLINE', label: 'אונליין' },
              { value: 'OFFLINE', label: 'אופליין' },
              { value: 'WOOCOMMERCE', label: 'WooCommerce' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 max-w-sm">
          <span className="text-sm text-slate-600">הצג וריאנטים כשורות נפרדות</span>
          <Switch
            checked={filters.showVariantsAsRows}
            onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, showVariantsAsRows: checked }))}
            aria-label="הצג וריאנטים כשורות נפרדות"
          />
        </div>
      </section>

      <ProductsKpiStrip
        kpis={kpis}
        activeIssue={filters.focusIssue}
        onIssueSelect={(issue) => setFilters((prev) => ({ ...prev, focusIssue: issue }))}
      />

      {selectedIds.length > 0 && (
        <div className="sticky top-3 z-20 rounded-xl border border-primary-200 bg-primary-50 p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary-700">
              <Filter className="h-4 w-4" />
              {selectedIds.length} מוצרים נבחרו
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={bulkStatus}
                onValueChange={(value) => setBulkStatus(value as ProductStatus)}
                options={[
                  { value: 'ACTIVE', label: 'הגדר כפעיל' },
                  { value: 'DRAFT', label: 'הגדר כטיוטה' },
                  { value: 'ARCHIVED', label: 'העבר לארכיון' },
                ]}
                className="h-8 w-36"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={applyStatusToSelected}
                disabled={updateMutation.isPending}
              >
                החל סטטוס
              </Button>
              <Select
                value={bulkProcurementType}
                onValueChange={(value) => setBulkProcurementType(value as ProcurementType)}
                options={[
                  { value: 'INVENTORY', label: 'מלאי מקומי' },
                  { value: 'DROPSHIP', label: 'אספקה חיצונית' },
                  { value: 'SPECIAL_ORDER', label: 'הזמנה מיוחדת' },
                ]}
                className="h-8 w-44"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={applyProcurementTypeToSelected}
                disabled={updateMutation.isPending}
              >
                עדכן סוג אספקה
              </Button>
            </div>
          </div>
        </div>
      )}

      <ProductsTable
        data={filteredProducts}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        onRowClick={(product) => setSelectedProductId(product.id)}
        onUpdateStock={handleUpdateStock}
        onUpdatePrice={handleUpdatePrice}
        onArchive={handleArchive}
        onDuplicate={handleDuplicate}
      />

      <ProductDrawer
        open={Boolean(selectedProduct)}
        product={selectedProduct}
        onOpenChange={(open) => !open && setSelectedProductId(null)}
        onSave={handleSave}
      />
    </div>
  );
}

function QuickChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-primary-500 text-on-dark' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
