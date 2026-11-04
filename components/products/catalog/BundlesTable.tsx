'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Boxes, Search, Plus, ChevronDown, ChevronUp, Package } from 'lucide-react';

interface BundleItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  isOptional: boolean;
  effectivePriceCents: number;
}

interface Bundle {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  basePriceCents: number | null;
  calculatedPriceCents: number;
  isActive: boolean;
  itemCount: number;
  items: BundleItem[];
  createdAt: string;
}

interface BundlesResponse {
  items: Bundle[];
  total: number;
  page: number;
  limit: number;
}

export function BundlesTable() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const limit = 20;

  const loadBundles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.set('q', search);

      const response = await fetch(`/api/bundles?${params}`);

      if (!response.ok) {
        throw new Error('Failed to load bundles');
      }

      const result = await response.json();

      if (result.success) {
        setBundles(result.data.items || []);
        setTotal(result.data.total || 0);
      } else {
        throw new Error(result.error?.message || 'Failed to load bundles');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error loading bundles:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadBundles();
    }, 300);
    return () => clearTimeout(debounce);
  }, [loadBundles]);

  const formatPrice = (cents: number | null) => {
    if (cents === null) return '-';
    return `₪${(cents / 100).toFixed(2)}`;
  };

  const toggleExpanded = (bundleId: string) => {
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(bundleId)) {
        next.delete(bundleId);
      } else {
        next.add(bundleId);
      }
      return next;
    });
  };

  const totalPages = Math.ceil(total / limit);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">שגיאה בטעינת חבילות: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-gray-100 shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Boxes className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-600">סה״כ חבילות</div>
              <div className="text-2xl font-bold text-gray-900">{total}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-600">חבילות פעילות</div>
              <div className="text-2xl font-bold text-gray-900">
                {bundles.filter((b) => b.isActive).length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש חבילה לפי שם או SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-on-dark rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          חבילה חדשה
        </button>
      </div>

      {/* Bundles Table */}
      <div className="rounded-xl border border-gray-100 shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">

                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    חבילה
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    מחיר בסיס
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    מחיר מחושב
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    מוצרים
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    סטטוס
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bundles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Boxes className="w-12 h-12 text-gray-300" />
                        <p>לא נמצאו חבילות מוצרים</p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="text-primary-600 hover:text-primary-800 font-medium"
                        >
                          צור חבילה ראשונה
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  bundles.map((bundle) => (
                    <React.Fragment key={bundle.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <button
                            onClick={() => toggleExpanded(bundle.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {expandedBundles.has(bundle.id) ? (
                              <ChevronUp className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                              <Boxes className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{bundle.name}</div>
                              {bundle.description && (
                                <div className="text-xs text-gray-500 truncate max-w-xs">
                                  {bundle.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 font-mono">{bundle.sku}</td>
                        <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                          {formatPrice(bundle.basePriceCents)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {formatPrice(bundle.calculatedPriceCents)}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {bundle.itemCount} מוצרים
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              bundle.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {bundle.isActive ? 'פעיל' : 'לא פעיל'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button className="text-primary-600 hover:text-primary-800 text-sm font-medium">
                            עריכה
                          </button>
                        </td>
                      </tr>
                      {/* Expanded items */}
                      {expandedBundles.has(bundle.id) && (
                        <tr>
                          <td colSpan={8} className="px-4 py-2 bg-gray-50">
                            <div className="pr-12">
                              <table className="min-w-full">
                                <thead>
                                  <tr>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                                      מוצר
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                                      SKU
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                                      כמות
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                                      מחיר יח׳
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                                      סוג
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bundle.items.map((item) => (
                                    <tr key={item.id} className="border-b border-gray-100 last:border-0">
                                      <td className="px-3 py-2 text-sm text-gray-900">
                                        {item.productName}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-500 font-mono">
                                        {item.productSku}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-900">
                                        {item.quantity}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-900">
                                        {formatPrice(item.effectivePriceCents)}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            item.isOptional
                                              ? 'bg-yellow-100 text-yellow-800'
                                              : 'bg-blue-100 text-blue-800'
                                          }`}
                                        >
                                          {item.isOptional ? 'אופציונלי' : 'חובה'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              מציג {(page - 1) * limit + 1} - {Math.min(page * limit, total)} מתוך {total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                הקודם
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                הבא
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
