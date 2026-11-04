import type { ReactNode } from 'react';

interface SalesDashboardProps {
  data: any;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function SalesDashboard({ data }: SalesDashboardProps) {
  const kpis = data?.kpis || {};

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">דשבורד מכירות</h1>
        <p className="text-sm text-gray-500">סקירת הכנסות, לידים חדשים והזמנות הדורשות תשומת לב</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="הכנסות חודשיות" value={formatCurrency(kpis.revenue?.value || 0)} />
        <MetricCard title="הזמנות פתוחות" value={`${kpis.openOrders?.value || 0}`} />
        <MetricCard title="לידים חדשים" value={`${kpis.newLeads?.value || 0}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="הזמנות לטיפול">
          {(data?.needsAttention || []).length === 0 ? (
            <div className="text-sm text-gray-500">אין הזמנות דחופות כרגע.</div>
          ) : (
            data.needsAttention.map((order: any) => (
              <div key={order.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">#{order.number}</div>
                    <div className="text-xs text-gray-500">{order.customer}</div>
                  </div>
                  <div className="text-sm text-amber-700">{order.status}</div>
                </div>
                <div className="mt-1 text-sm text-gray-600">{formatCurrency(order.amount || 0)}</div>
              </div>
            ))
          )}
        </SectionCard>

        <SectionCard title="מכירות יומיות">
          <div className="flex h-56 items-end gap-2">
            {(data?.dailySales || []).slice(-14).map((point: any) => (
              <div key={point.date} className="flex-1">
                <div
                  className="rounded-t bg-blue-500"
                  style={{ height: `${Math.max(point.amount || 0, 1) / 5}px` }}
                  title={`${point.date}: ${point.amount}`}
                />
                <div className="mt-1 text-center text-[10px] text-gray-500">
                  {String(point.date).slice(5)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}
