'use client';

import { MaterialCard, MaterialCardContent } from '@/components/ui/MaterialCard';
import { Skeleton } from '@/components/ui/SkeletonLoader';
import { useManagementKPIs } from '@/lib/hooks/api/analytics/useManagementKPIs';
// Optimization: Use cached Intl formatters to avoid expensive re-instantiation
import { formatCurrency, formatNumber } from '@/lib/utils';
import { DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react';

export function ManagementKPICards() {
  const { data, isLoading } = useManagementKPIs();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: 'סך הכנסות (חודשי)',
      value: data ? formatCurrency(data.totalRevenue) : formatCurrency(0),
      icon: DollarSign,
      color: 'text-emerald-700',
      bg: 'bg-emerald-100',
    },
    {
      label: 'הזמנות פעילות',
      value: data ? formatNumber(data.totalOrders) : '0',
      icon: ShoppingCart,
      color: 'text-blue-700',
      bg: 'bg-blue-100',
    },
    {
      label: 'לקוחות פעילים',
      value: data ? formatNumber(data.activeCustomers) : '0',
      icon: Users,
      color: 'text-blue-700',
      bg: 'bg-blue-100',
    },
    {
      label: 'לקוחות חדשים',
      value: data ? formatNumber(data.newCustomers) : '0',
      icon: TrendingUp,
      color: 'text-blue-700',
      bg: 'bg-blue-100',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, i) => (
        <MaterialCard key={i} variant="elevated" className="border-l-4 border-l-transparent hover:border-l-action transition-all">
          <MaterialCardContent className="p-6 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
              <div className="text-2xl font-bold font-english tracking-tight">{kpi.value}</div>
            </div>
            <div className={`p-3 rounded-full ${kpi.bg} ${kpi.color}`}>
              <kpi.icon className="h-5 w-5" />
            </div>
          </MaterialCardContent>
        </MaterialCard>
      ))}
    </div>
  );
}
