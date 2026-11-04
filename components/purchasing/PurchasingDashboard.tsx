import type { ReactNode } from 'react';

interface PurchasingDashboardProps {
  data: any;
}

function formatCurrency(valueCents: number) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format((valueCents || 0) / 100);
}

export function PurchasingDashboard({ data }: PurchasingDashboardProps) {
  const kpis = data?.kpis || {};

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">דשבורד רכש</h1>
        <p className="text-sm text-gray-500">מעקב אחר הזמנות רכש, מחסורים וסחורה נכנסת</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="הזמנות רכש פתוחות" value={`${kpis.openPos?.value || 0}`} />
        <MetricCard title="מוצרים חסרים" value={`${kpis.outOfStock?.value || 0}`} />
        <MetricCard title="מק״טים פעילים" value={`${kpis.activeSkus?.value || 0}`} />
        <MetricCard title="ספקים פעילים" value={`${kpis.activeSuppliers?.value || 0}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="סחורה נכנסת">
          {(data?.incomingStock?.items || []).length === 0 ? (
            <EmptyState />
          ) : (
            data.incomingStock.items.map((po: any) => (
              <div key={po.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">{po.reference}</div>
                    <div className="text-xs text-gray-500">{po.supplierName}</div>
                  </div>
                  <div className="text-sm text-gray-600">{po.status}</div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {po.itemsReceived}/{po.itemsTotal} יחידות • {formatCurrency(po.totalValueCents)}
                </div>
              </div>
            ))
          )}
        </SectionCard>

        <SectionCard title="ביקוש פתוח">
          {(data?.demandQueue || []).length === 0 ? (
            <EmptyState />
          ) : (
            data.demandQueue.slice(0, 8).map((item: any) => (
              <div key={item.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="font-semibold text-gray-900">{item.productName}</div>
                <div className="text-xs text-gray-500">
                  {item.sku} • {item.customerName}
                </div>
                <div className="mt-1 text-sm text-amber-700">כמות דרושה: {item.qty}</div>
              </div>
            ))
          )}
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
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EmptyState() {
  return <div className="text-sm text-gray-500">אין נתונים זמינים כרגע.</div>;
}
