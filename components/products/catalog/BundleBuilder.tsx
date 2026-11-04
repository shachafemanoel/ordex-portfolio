'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Search, Trash2, GripVertical, Package, Boxes } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  basePriceCents: number | null;
  stock: number;
}

interface BundleItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  sortOrder: number;
  isOptional: boolean;
  overridePriceCents: number | null;
  basePriceCents: number | null;
}

interface BundleBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bundle: BundleFormData) => void;
  editBundle?: {
    id: string;
    name: string;
    sku: string;
    description: string | null;
    basePriceCents: number | null;
    items: BundleItem[];
  };
}

interface BundleFormData {
  name: string;
  sku: string;
  description: string;
  basePriceCents: number | null;
  inventoryEnabled: boolean;
  procurementRequired: boolean;
  items: {
    productId: string;
    quantity: number;
    sortOrder: number;
    isOptional: boolean;
    overridePriceCents: number | null;
  }[];
}

export function BundleBuilder({ isOpen, onClose, onSave, editBundle }: BundleBuilderProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [basePriceCents, setBasePriceCents] = useState<number | null>(null);
  const [useBundlePrice, setUseBundlePrice] = useState(false);
  const [items, setItems] = useState<BundleItem[]>([]);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [procurementRequired, setProcurementRequired] = useState(false);

  // Product search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when editing
  useEffect(() => {
    if (editBundle) {
      setName(editBundle.name);
      setSku(editBundle.sku);
      setDescription(editBundle.description || '');
      setBasePriceCents(editBundle.basePriceCents);
      setUseBundlePrice(editBundle.basePriceCents !== null);
      setItems(editBundle.items);
    } else {
      // Reset form for new bundle
      setName('');
      setSku('');
      setDescription('');
      setBasePriceCents(null);
      setUseBundlePrice(false);
      setItems([]);
      setInventoryEnabled(false);
      setProcurementRequired(false);
    }
  }, [editBundle, isOpen]);

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await fetch(`/api/products?q=${encodeURIComponent(query)}&limit=10`);
      const result = await response.json();

      if (result.success) {
        // Filter out bundles and already added products
        const existingIds = items.map((i) => i.productId);
        const filtered = (result.data.items || []).filter(
          (p: Product & { isBundle?: boolean }) => !p.isBundle && !existingIds.includes(p.id)
        );
        setSearchResults(filtered);
      }
    } catch (err) {
      console.error('Error searching products:', err);
    } finally {
      setSearching(false);
    }
  }, [items]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchProducts]);

  const addProduct = (product: Product) => {
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: 1,
        sortOrder: prev.length,
        isOptional: false,
        overridePriceCents: null,
        basePriceCents: product.basePriceCents,
      },
    ]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateItem = (productId: string, updates: Partial<BundleItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, ...updates } : item))
    );
  };

  const calculateTotalPrice = () => {
    return items.reduce((total, item) => {
      const price = item.overridePriceCents ?? item.basePriceCents ?? 0;
      return total + price * item.quantity;
    }, 0);
  };

  const handleSave = async () => {
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('נא להזין שם לחבילה');
      return;
    }
    if (!sku.trim()) {
      setError('נא להזין SKU לחבילה');
      return;
    }
    if (items.length === 0) {
      setError('נא להוסיף לפחות מוצר אחד לחבילה');
      return;
    }

    setSaving(true);

    try {
      const formData: BundleFormData = {
        name: name.trim(),
        sku: sku.trim(),
        description: description.trim(),
        basePriceCents: useBundlePrice ? basePriceCents : null,
        inventoryEnabled,
        procurementRequired,
        items: items.map((item, index) => ({
          productId: item.productId,
          quantity: item.quantity,
          sortOrder: index,
          isOptional: item.isOptional,
          overridePriceCents: item.overridePriceCents,
        })),
      };

      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת החבילה');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (cents: number | null) => {
    if (cents === null) return '-';
    return (cents / 100).toFixed(2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" dir="rtl">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Boxes className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {editBundle ? 'עריכת חבילה' : 'יצירת חבילה חדשה'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם החבילה <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="לדוגמה: חבילת התקנה בסיסית"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  disabled={!!editBundle}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono disabled:bg-gray-100"
                  placeholder="BUNDLE-001"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="תיאור קצר של החבילה..."
              />
            </div>

            {/* Pricing */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useBundlePrice"
                  checked={useBundlePrice}
                  onChange={(e) => setUseBundlePrice(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="useBundlePrice" className="text-sm font-medium text-gray-700">
                  הגדר מחיר קבוע לחבילה (במקום סכום המוצרים)
                </label>
              </div>

              {useBundlePrice && (
                <div className="w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    מחיר החבילה (₪)
                  </label>
                  <input
                    type="number"
                    value={basePriceCents ? basePriceCents / 100 : ''}
                    onChange={(e) =>
                      setBasePriceCents(e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}

              <div className="text-sm text-gray-600">
                מחיר מחושב (סכום המוצרים):{' '}
                <span className="font-semibold">₪{formatPrice(calculateTotalPrice())}</span>
              </div>
            </div>

            {/* Options */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={inventoryEnabled}
                  onChange={(e) => setInventoryEnabled(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">מעקב מלאי</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={procurementRequired}
                  onChange={(e) => setProcurementRequired(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">דרוש רכש</span>
              </label>
            </div>

            {/* Product Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">הוסף מוצרים לחבילה</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="חפש מוצר לפי שם או SKU..."
                />
                {searching && (
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addProduct(product)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-right"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">₪{formatPrice(product.basePriceCents)}</span>
                        <Plus className="w-4 h-4 text-primary-600" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bundle Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                מוצרים בחבילה ({items.length})
              </label>
              {items.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-gray-200 rounded-lg text-center">
                  <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">חפש והוסף מוצרים לחבילה</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <div key={item.productId} className="p-4 flex items-center gap-4">
                      <GripVertical className="w-5 h-5 text-gray-300 cursor-move" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                        <div className="text-xs text-gray-500">SKU: {item.productSku}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Quantity */}
                        <div className="w-20">
                          <label className="block text-xs text-gray-500 mb-1">כמות</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.productId, {
                                quantity: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            min="1"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center"
                          />
                        </div>
                        {/* Override Price */}
                        <div className="w-24">
                          <label className="block text-xs text-gray-500 mb-1">מחיר (₪)</label>
                          <input
                            type="number"
                            value={
                              item.overridePriceCents !== null
                                ? item.overridePriceCents / 100
                                : item.basePriceCents !== null
                                  ? item.basePriceCents / 100
                                  : ''
                            }
                            onChange={(e) =>
                              updateItem(item.productId, {
                                overridePriceCents: e.target.value
                                  ? Math.round(parseFloat(e.target.value) * 100)
                                  : null,
                              })
                            }
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center"
                            placeholder={formatPrice(item.basePriceCents)}
                          />
                        </div>
                        {/* Optional */}
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={item.isOptional}
                            onChange={(e) =>
                              updateItem(item.productId, { isOptional: e.target.checked })
                            }
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          אופציונלי
                        </label>
                        {/* Remove */}
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              סה״כ מחיר:{' '}
              <span className="font-bold text-gray-900">
                ₪{formatPrice(useBundlePrice && basePriceCents ? basePriceCents : calculateTotalPrice())}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-on-dark rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'שומר...' : editBundle ? 'עדכן חבילה' : 'צור חבילה'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
