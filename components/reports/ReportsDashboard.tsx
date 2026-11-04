'use client';

import { Button } from '@/components/ui/Button';
import {
  StitchPageHeader,
  StitchPageShell,
  StitchPanel,
  StitchStatCard,
  StitchTabButton,
} from '@/components/stitch/StitchShell';
import {
  DashboardOverviewResponse,
  useDashboardOverview,
} from '@/lib/hooks/api/dashboard/useDashboardOverview';
import {
  ArrowUpLeft,
  Boxes,
  CalendarRange,
  Download,
  PieChart,
  ShoppingCart,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface ReportsDashboardProps {
  initialOverview?: DashboardOverviewResponse | null;
}

const currencyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('he-IL', {
  maximumFractionDigits: 1,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) {
    return 'N/A';
  }

  return `${percentFormatter.format(value)}%`;
}

function groupRecentOrders(overview: DashboardOverviewResponse) {
  const grouped = new Map<string, { label: string; revenue: number; count: number }>();

  overview.recentOrders.forEach((order) => {
    const date = new Date(order.createdAt);
    const key = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
    const current = grouped.get(key);

    if (current) {
      current.revenue += Number(order.totalAmount || 0);
      current.count += 1;
      return;
    }

    grouped.set(key, {
      label,
      revenue: Number(order.totalAmount || 0),
      count: 1,
    });
  });

  return Array.from(grouped.values()).slice(-6);
}

export function ReportsDashboard({
  initialOverview = null,
}: Readonly<ReportsDashboardProps>) {
  const { data } = useDashboardOverview({
    initialData: initialOverview ?? undefined,
    refetchInterval: 60_000,
  });
  const overview = data ?? initialOverview;
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'performance'>('overview');

  const chartBars = useMemo(
    () => (overview ? groupRecentOrders(overview) : []),
    [overview]
  );

  const statusItems = useMemo(() => {
    if (!overview) {
      return [];
    }

    const total = Math.max(overview.summary.totalOrders, 1);
    return [...overview.statusCounts]
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((item) => ({
        ...item,
        percent: Math.round((item.count / total) * 100),
      }));
  }, [overview]);

  const recentOrders = overview?.recentOrders ?? [];
  const highestOrder = recentOrders.reduce((current, order) => {
    return Number(order.totalAmount || 0) > Number(current?.totalAmount || 0) ? order : current;
  }, recentOrders[0]);

  return (
    <StitchPageShell>
      <StitchPageHeader
        title="סטטיסטיקות ודוחות"
        description="מרכז בקרה אחד למדדי הזמנות, הכנסות ותמונת עומס תפעולית בזמן אמת."
        meta={
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-[#75665d]">
              <CalendarRange className="h-3.5 w-3.5 text-accent-600" />
              30 הימים האחרונים
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-[#75665d]">
              עודכן כעת מה-dashboard overview
            </span>
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              icon={<Download className="h-4 w-4" />}
            >
              ייצוא מהיר
            </Button>
            <Button asChild icon={<ArrowUpLeft className="h-4 w-4" />}>
              <Link href="/dashboard">חזרה ללוח הבקרה</Link>
            </Button>
          </>
        }
        tabs={
          <>
            <StitchTabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              מבט על
            </StitchTabButton>
            <StitchTabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')}>
              הזמנות וסטטוסים
            </StitchTabButton>
            <StitchTabButton
              active={activeTab === 'performance'}
              onClick={() => setActiveTab('performance')}
            >
              ביצועים ותפעול
            </StitchTabButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StitchStatCard
          label="סה״כ הכנסות"
          value={formatCurrency(overview?.summary.totalRevenue ?? 0)}
          hint={`${formatPercent(overview?.summary.monthlyGrowth ?? 0)} שינוי חודשי`}
          icon={TrendingUp}
          tone="primary"
        />
        <StitchStatCard
          label="הזמנות פעילות"
          value={overview?.summary.totalOrders ?? 0}
          hint={`${overview?.summary.completed ?? 0} הושלמו`}
          icon={ShoppingCart}
          tone="info"
        />
        <StitchStatCard
          label="לקוחות פעילים"
          value={overview?.summary.activeCustomers ?? 0}
          hint={`${overview?.summary.customers.total ?? 0} לקוחות במערכת`}
          icon={Users}
          tone="success"
        />
        <StitchStatCard
          label="התקנות ממתינות"
          value={overview?.summary.installationsPending ?? 0}
          hint={formatPercent(overview?.summary.serviceLevel ?? null)}
          icon={Wrench}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <StitchPanel
          title="מגמת הזמנות אחרונות"
          description="סיכום הכנסות מהזמנות שנוצרו לאחרונה, בקיבוץ לפי יום."
        >
          {chartBars.length > 0 ? (
            <div className="space-y-6">
              <div className="flex h-72 items-end gap-3 rounded-[24px] bg-[#fff9f5] p-5">
                {chartBars.map((bar) => {
                  const maxRevenue = Math.max(...chartBars.map((item) => item.revenue), 1);
                  const height = Math.max((bar.revenue / maxRevenue) * 100, 18);

                  return (
                    <div key={bar.label} className="flex flex-1 flex-col items-center gap-3">
                      <div className="text-[11px] font-bold text-[#9d8b80]">
                        {formatCurrency(bar.revenue)}
                      </div>
                      <div className="flex h-52 w-full items-end rounded-[18px] bg-white px-2 pb-2 shadow-inner">
                        <div
                          className="w-full rounded-[14px] bg-gradient-to-t from-accent-500 to-[#ffb38d]"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="text-xs font-bold text-[#7e6e64]">{bar.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] bg-[#fff4ed] p-4">
                  <p className="text-xs font-bold text-[#9d8b80]">ערך הזמנה ממוצע</p>
                  <p className="mt-2 text-xl font-black text-[#221610]">
                    {formatCurrency(overview?.summary.avgOrderValue ?? 0)}
                  </p>
                </div>
                <div className="rounded-[22px] bg-[#eef5ff] p-4">
                  <p className="text-xs font-bold text-[#9d8b80]">המוצרים במערכת</p>
                  <p className="mt-2 text-xl font-black text-[#221610]">
                    {overview?.summary.products.total ?? 0}
                  </p>
                </div>
                <div className="rounded-[22px] bg-[#eef8f1] p-4">
                  <p className="text-xs font-bold text-[#9d8b80]">הזמנה מובילה</p>
                  <p className="mt-2 text-lg font-black text-[#221610]">
                    {highestOrder?.number ?? 'אין נתון'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#fff9f5] p-8 text-sm font-medium text-[#7e6e64]">
              אין מספיק נתונים לשרטט מגמה.
            </div>
          )}
        </StitchPanel>

        <StitchPanel
          title="סטטוס הזמנות"
          description="ההתפלגות המובילה מתוך כלל ההזמנות במערכת."
        >
          <div className="space-y-5">
            {statusItems.length > 0 ? (
              statusItems.map((item) => (
                <div key={item.status} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-[#221610]">{item.label}</span>
                    <span className="font-semibold text-[#75665d]">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#f2ece8]">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-accent-500 to-[#f9b08b]"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-bold text-[#9d8b80]">{item.percent}% מהמערכת</div>
                </div>
              ))
            ) : (
              <p className="text-sm font-medium text-[#7e6e64]">אין סטטוסים זמינים כרגע.</p>
            )}
          </div>
        </StitchPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_0.9fr_0.9fr]">
        <StitchPanel
          title="הזמנות אחרונות"
          description="רשימת ההזמנות האחרונות שעלו למערכת."
          actions={
            <Button asChild variant="ghost" className="text-accent-600 hover:bg-[var(--color-accent-50)]">
              <Link href="/orders">לכל ההזמנות</Link>
            </Button>
          }
        >
          <div className="space-y-3">
            {recentOrders.length > 0 ? (
              recentOrders.slice(0, 6).map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded-[22px] border border-[#f2ece8] px-4 py-3 transition-colors hover:border-[#f3c7b0] hover:bg-[#fff9f5]"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-black text-[#221610]">{order.customerName}</div>
                    <div className="text-xs font-semibold text-[#8b7c72]">
                      {order.number} • {new Date(order.createdAt).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                  <div className="space-y-1 text-left">
                    <div className="text-sm font-black text-[#221610]">
                      {formatCurrency(Number(order.totalAmount || 0))}
                    </div>
                    <div className="text-xs font-bold text-accent-600">{order.status}</div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm font-medium text-[#7e6e64]">אין הזמנות להצגה כרגע.</p>
            )}
          </div>
        </StitchPanel>

        <StitchPanel title="תובנות מהירות" description="מדדים שנגזרים מהנתונים הפעילים במסך.">
          <div className="space-y-3">
            <div className="rounded-[22px] bg-[#fff6ef] p-4">
              <div className="text-xs font-bold text-[#9d8b80]">רמת שירות</div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-2xl font-black text-[#221610]">
                  {formatPercent(overview?.summary.serviceLevel ?? null)}
                </span>
                <PieChart className="h-5 w-5 text-accent-600" />
              </div>
            </div>
            <div className="rounded-[22px] bg-[#eef8f1] p-4">
              <div className="text-xs font-bold text-[#9d8b80]">לקוחות פעילים החודש</div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-2xl font-black text-[#221610]">
                  {overview?.summary.activeCustomers ?? 0}
                </span>
                <Users className="h-5 w-5 text-[#17a34a]" />
              </div>
            </div>
            <div className="rounded-[22px] bg-[#eef4ff] p-4">
              <div className="text-xs font-bold text-[#9d8b80]">מלאי ומוצרים</div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-2xl font-black text-[#221610]">
                  {overview?.summary.products.total ?? 0}
                </span>
                <Boxes className="h-5 w-5 text-[#2f6cf6]" />
              </div>
            </div>
          </div>
        </StitchPanel>

        <StitchPanel title="קיצורי דרך" description="ניווט מהיר למסכי הדוחות הקיימים במערכת.">
          <div className="space-y-3">
            {[
              { href: '/reports/status', label: 'דוח סטטוסים' },
              { href: '/reports/by-period', label: 'דוח מכירות תקופתי' },
              { href: '/reports/waiting-stock', label: 'ממתינים למלאי' },
              { href: '/reports/purchase', label: 'דוח רכש' },
              { href: '/reports/history', label: 'היסטוריית הזמנות' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-[22px] border border-[#f2ece8] px-4 py-3 text-sm font-bold text-[#221610] transition-colors hover:border-[#f3c7b0] hover:bg-[#fff9f5]"
              >
                <span>{item.label}</span>
                <ArrowUpLeft className="h-4 w-4 text-accent-600" />
              </Link>
            ))}
          </div>
        </StitchPanel>
      </div>
    </StitchPageShell>
  );
}
