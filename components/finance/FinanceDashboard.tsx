interface FinanceDashboardProps {
  data: any;
  error?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function FinanceDashboard({ data, error }: FinanceDashboardProps) {
  if (!data) {
    return (
      <div className="rounded-3xl border border-red-100 bg-white p-8 text-center" dir="rtl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">דשבורד פיננסי</h1>
        <p className="text-red-600">{error || 'לא ניתן לטעון נתונים כרגע.'}</p>
      </div>
    );
  }

  const kpis = data.kpis || {};

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">דשבורד פיננסי</h1>
        <p className="text-sm text-gray-500">סקירת הכנסות, חובות פתוחים ותשלומים אחרונים</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="הכנסות" value={formatCurrency(kpis.revenue?.value || 0)} />
        <MetricCard
          title="חשבוניות פתוחות"
          value={`${kpis.openInvoices?.count || 0}`}
          helper={formatCurrency(kpis.openInvoices?.amount || 0)}
        />
        <MetricCard title="הוצאות רכש" value={formatCurrency(kpis.expenses?.value || 0)} />
        <MetricCard title="רווח נקי" value={formatCurrency(kpis.netProfit?.value || 0)} />
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">תשלומים אחרונים</h2>
        <div className="space-y-3">
          {(data.recentPayments || []).length === 0 ? (
            <div className="text-sm text-gray-500">אין תשלומים להצגה.</div>
          ) : (
            data.recentPayments.map((payment: any) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-2xl border border-gray-100 p-4"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {payment.customer || 'לקוח לא ידוע'}
                  </div>
                  <div className="text-xs text-gray-500">
                    הזמנה #{payment.orderNumber || 'ללא מספר'} • {payment.method}
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-emerald-700">
                    {formatCurrency(payment.amount || 0)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {payment.date ? new Date(payment.date).toLocaleDateString('he-IL') : 'ללא תאריך'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
      {helper ? <div className="mt-1 text-xs text-gray-500">{helper}</div> : null}
    </div>
  );
}
