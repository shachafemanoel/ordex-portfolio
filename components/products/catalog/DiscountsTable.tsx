'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tag, Search, Plus, Percent, Calendar, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface Discount {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  type: string;
  valueType: string;
  value: number;
  minOrderCents: number | null;
  maxDiscountCents: number | null;
  usageLimit: number | null;
  usageCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  appliesToAll: boolean;
  isExpired: boolean;
  isStarted: boolean;
  remainingUses: number | null;
  createdAt: string;
}

const discountTypeLabels: Record<string, string> = {
  COUPON: 'קוד קופון',
  AUTOMATIC: 'אוטומטי',
  BUNDLE_DISCOUNT: 'הנחת חבילה',
  VOLUME: 'הנחת כמות',
  SEASONAL: 'מבצע עונתי',
};

const valueTypeLabels: Record<string, string> = {
  PERCENTAGE: 'אחוזים',
  FIXED_AMOUNT: 'סכום קבוע',
  FIXED_PRICE: 'מחיר קבוע',
};

export function DiscountsTable() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const limit = 20;

  const loadDiscounts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.set('q', search);

      const response = await fetch(`/api/discounts?${params}`);

      if (!response.ok) {
        throw new Error('Failed to load discounts');
      }

      const result = await response.json();

      if (result.success) {
        setDiscounts(result.data.items || []);
        setTotal(result.data.total || 0);
      } else {
        throw new Error(result.error?.message || 'Failed to load discounts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error loading discounts:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadDiscounts();
    }, 300);
    return () => clearTimeout(debounce);
  }, [loadDiscounts]);

  const formatPrice = (cents: number | null) => {
    if (cents === null) return '-';
    return `₪${(cents / 100).toFixed(2)}`;
  };

  const formatValue = (discount: Discount) => {
    switch (discount.valueType) {
      case 'PERCENTAGE':
        return `${discount.value}%`;
      case 'FIXED_AMOUNT':
        return `₪${discount.value}`;
      case 'FIXED_PRICE':
        return `מחיר: ₪${discount.value}`;
      default:
        return discount.value;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDiscountStatus = (discount: Discount) => {
    if (!discount.isActive) {
      return { label: 'לא פעיל', color: 'bg-gray-100 text-gray-800', icon: XCircle };
    }
    if (discount.isExpired) {
      return { label: 'פג תוקף', color: 'bg-red-100 text-red-800', icon: AlertCircle };
    }
    if (!discount.isStarted) {
      return { label: 'ממתין', color: 'bg-yellow-100 text-yellow-800', icon: Calendar };
    }
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return { label: 'נוצל', color: 'bg-blue-100 text-blue-800', icon: AlertCircle };
    }
    return { label: 'פעיל', color: 'bg-green-100 text-green-800', icon: CheckCircle };
  };

  const totalPages = Math.ceil(total / limit);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">שגיאה בטעינת הנחות: {error}</p>
      </div>
    );
  }

  const activeDiscounts = discounts.filter((d) => d.isActive && !d.isExpired && d.isStarted);
  const expiredDiscounts = discounts.filter((d) => d.isExpired);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-gray-100 shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Tag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-600">סה״כ הנחות</div>
              <div className="text-2xl font-bold text-gray-900">{total}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-600">פעילות</div>
              <div className="text-2xl font-bold text-gray-900">{activeDiscounts.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-600">פגו תוקף</div>
              <div className="text-2xl font-bold text-gray-900">{expiredDiscounts.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Percent className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-600">שימושים</div>
              <div className="text-2xl font-bold text-gray-900">
                {discounts.reduce((sum, d) => sum + d.usageCount, 0)}
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
            placeholder="חיפוש הנחה לפי שם או קוד..."
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
          הנחה חדשה
        </button>
      </div>

      {/* Discounts Table */}
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
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    הנחה
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    קוד
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    סוג
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    ערך
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    שימושים
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    תוקף
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
                {discounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Tag className="w-12 h-12 text-gray-300" />
                        <p>לא נמצאו הנחות</p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="text-primary-600 hover:text-primary-800 font-medium"
                        >
                          צור הנחה ראשונה
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  discounts.map((discount) => {
                    const status = getDiscountStatus(discount);
                    const StatusIcon = status.icon;
                    return (
                      <tr key={discount.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              {discount.valueType === 'PERCENTAGE' ? (
                                <Percent className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Tag className="w-5 h-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{discount.name}</div>
                              {discount.description && (
                                <div className="text-xs text-gray-500 truncate max-w-xs">
                                  {discount.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {discount.code ? (
                            <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                              {discount.code}
                            </code>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {discountTypeLabels[discount.type] || discount.type}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatValue(discount)}
                          </span>
                          {discount.minOrderCents && (
                            <div className="text-xs text-gray-500">
                              מינימום: {formatPrice(discount.minOrderCents)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className="font-medium text-gray-900">{discount.usageCount}</span>
                          {discount.usageLimit && (
                            <span className="text-gray-500"> / {discount.usageLimit}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          <div className="space-y-1">
                            {discount.startsAt && (
                              <div className="text-xs">מ: {formatDate(discount.startsAt)}</div>
                            )}
                            {discount.expiresAt && (
                              <div className="text-xs">עד: {formatDate(discount.expiresAt)}</div>
                            )}
                            {!discount.startsAt && !discount.expiresAt && (
                              <span className="text-gray-400">ללא הגבלה</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button className="text-primary-600 hover:text-primary-800 text-sm font-medium">
                            עריכה
                          </button>
                        </td>
                      </tr>
                    );
                  })
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
