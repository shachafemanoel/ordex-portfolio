'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/apiClient';
// Optimization: Use cached Intl formatters to avoid expensive re-instantiation
import { formatCurrency, formatCurrencyCents, formatDate, formatNumber } from '@/lib/utils';
import type { ManagementOverviewData } from '@/services/managementOverviewService';

interface ManagementOverviewEnvelope {
  success: boolean;
  data: ManagementOverviewData | null;
  error: { message: string } | null;
}

const ERROR_MESSAGE = 'שגיאה בטעינת נתוני ניהול החנות';

export function ManagementOverviewScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ManagementOverviewData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient('/api/management/overview', { cache: 'no-store' });
      const json: ManagementOverviewEnvelope = await res.json();

      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message || ERROR_MESSAGE);
      }

      setData(json.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : ERROR_MESSAGE;
      setError(message || ERROR_MESSAGE);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusTotal = useMemo(() => {
    if (!data) return 0;
    return data.stats.orders.statusBreakdown.reduce((sum, row) => sum + row.count, 0);
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="טוען נתוני חנות..." />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState error={error ?? ERROR_MESSAGE} onRetry={load} />;
  }

  const { stats } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">מרכז ניהול החנות</h1>
        <p className="text-sm text-gray-600">מעקב אחר לקוחות, הזמנות, מלאי וצוות – במקום אחד.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/orders/new">פתיחת הזמנה חדשה</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/orders">חזרה לרשימת הזמנות</Link>
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="לקוחות פעילים"
          value={formatNumber(stats.customers.activeThisMonth)}
          helper="חודש נוכחי"
        />
        <SummaryCard
          title="הזמנות פתוחות"
          value={formatNumber(stats.orders.total)}
          helper="סה״כ במערכת"
        />
        <SummaryCard
          title="מק״טים במלאי"
          value={formatNumber(stats.products.totalSkus)}
          helper="כולל וריאציות"
        />
        <SummaryCard
          title="משתמשי צוות"
          value={formatNumber(stats.team.totalUsers)}
          helper="פעילים"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Days Sales Outstanding"
          value={
            stats.orders.dsoDays !== null ? `${formatNumber(stats.orders.dsoDays)} ימים` : '—'
          }
          helper="חובות פתוחים / מכירות 30 יום אחרונים"
        />
        <SummaryCard
          title="זמן מחזור הזמנה (מדיאן)"
          value={
            stats.orders.cycleTime.medianDays !== null
              ? `${formatNumber(stats.orders.cycleTime.medianDays)} ימים`
              : '—'
          }
          helper={
            stats.orders.cycleTime.averageDays !== null
              ? `ממוצע ${formatNumber(stats.orders.cycleTime.averageDays)} ימים • ${stats.orders.cycleTime.sampleSize} דגימות`
              : `${stats.orders.cycleTime.sampleSize} דגימות`
          }
        />
        <SummaryCard
          title="אספקה בזמן"
          value={
            stats.orders.onTimeDelivery.rate !== null ? `${stats.orders.onTimeDelivery.rate}%` : '—'
          }
          helper={`נבדקו ${stats.orders.onTimeDelivery.totalEvaluated} משלוחים • ${stats.orders.onTimeDelivery.lateCount} באיחור`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>התפלגות סטטוסים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.orders.statusBreakdown.map((row, index) => {
              const percentage = statusTotal > 0 ? Math.round((row.count / statusTotal) * 100) : 0;
              return (
                <div key={`${row.status}-${index}`}>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{row.status}</span>
                    <span>{formatNumber(row.count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>מגמת הזמנות 7 ימים</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2 h-48 items-end">
            {stats.orders.trend.map((point) => (
              <div key={point.date} className="flex-1">
                <div
                  className="rounded-t bg-emerald-500"
                  style={{ height: `${Math.max(point.count, 1) * 12}px` }}
                  title={`${point.date}: ${point.count}`}
                />
                <div className="text-[10px] text-gray-500 mt-1 text-center">
                  {point.date.slice(5)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>לקוחות מובילים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.customers.topByValue.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-xs text-gray-500">{customer.ordersCount} הזמנות</div>
                </div>
                <div className="text-sm font-semibold text-emerald-600">
                  {formatCurrency(customer.clv)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>לקוחות חדשים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.customers.recent.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-xs text-gray-500">{customer.phone || 'ללא טלפון'}</div>
                </div>
                <div className="text-xs text-gray-500">{formatDate(customer.createdAt)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>מלאי נמוך</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.products.lowStock.length === 0 && (
              <div className="text-sm text-gray-500">אין התראות מלאי כרגע.</div>
            )}
            {stats.products.lowStock.map((sku) => (
              <div key={sku.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="font-semibold">{sku.name}</div>
                  <div className="text-xs text-gray-500">{sku.code}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-rose-600">מלאי: {sku.stock}</div>
                  <div className="text-xs text-gray-500">יעד: {sku.reorderLevel}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ביצועי צוות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.team.topPerformers.length === 0 && (
              <div className="text-sm text-gray-500">אין נתוני צוות זמינים.</div>
            )}
            {stats.team.topPerformers.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <div className="font-semibold">{member.name}</div>
                  <div className="text-xs text-gray-500">{member.role}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{member.ordersHandled} הזמנות</div>
                  <div className="text-xs text-gray-500">
                    {formatCurrencyCents(member.revenueCents)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>מוצרים מובילים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.products.topSelling.map((product) => (
              <div
                key={product.sku}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <div className="font-semibold">{product.name}</div>
                  <div className="text-xs text-gray-500">{product.sku}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{product.units} יחידות</div>
                  <div className="text-xs text-gray-500">{formatCurrency(product.revenue)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>פיזור תפקידים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.team.roles.map((role) => (
              <div key={role.role} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{role.role}</span>
                <span className="text-sm font-semibold">{role.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-gray-500">{helper}</div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-600 mt-1">{title}</div>
      </CardContent>
    </Card>
  );
}

export default ManagementOverviewScreen;
