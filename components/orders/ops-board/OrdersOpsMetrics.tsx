'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, PhoneCall, Zap } from 'lucide-react';

import type { OrdersOpsInsights } from './useOrdersOpsBoard';

function formatMetricCount(value: number) {
  return new Intl.NumberFormat('he-IL').format(value);
}

interface OrdersOpsKpiCardProps {
  label: string;
  value: number;
  helper: string;
  tone: 'alert' | 'active' | 'contact';
  className?: string;
}

function OrdersOpsKpiCard({
  label,
  value,
  helper,
  tone,
  className,
}: Readonly<OrdersOpsKpiCardProps>) {
  const toneConfig =
    tone === 'alert'
      ? {
          icon: AlertTriangle,
          dot: 'bg-status-warning',
          surface: 'surface-ops-kpi-alert',
          value: 'text-warning',
          helper: 'text-fg-muted',
        }
      : tone === 'active'
        ? {
            icon: Zap,
            dot: 'bg-status-info',
            surface: 'surface-ops-kpi-active',
            value: 'text-brand-deep',
            helper: 'text-ops-muted',
          }
        : {
            icon: PhoneCall,
            dot: 'bg-status-success',
            surface: 'surface-ops-kpi-contact',
            value: 'text-fg',
            helper: 'text-fg-muted',
          };
  const Icon = toneConfig.icon;

  return (
    <div
      className={cn(
        'rounded-[24px] border px-3.5 py-3.5 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.28)] backdrop-blur-sm',
        toneConfig.surface,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-fg-muted">
            <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', toneConfig.dot)} />
            <span>{label}</span>
          </dt>
          <dd
            className={cn(
              'mt-2 text-[clamp(1.4rem,1.1rem+1.5vw,2rem)] font-black leading-none tabular-nums',
              toneConfig.value
            )}
          >
            {formatMetricCount(value)}
          </dd>
          <p className={cn('mt-2 text-[11px] font-semibold leading-5', toneConfig.helper)}>
            {helper}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-translucent-strong text-fg-muted shadow-sm">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

interface OrdersOpsMetricsProps {
  totalCount: number;
  insights: OrdersOpsInsights;
}

export function OrdersOpsMetrics({
  totalCount,
  insights,
}: Readonly<OrdersOpsMetricsProps>) {
  return (
    <section
      aria-labelledby="orders-kpi-heading"
      aria-live="polite"
      className="surface-ops-glass rounded-[28px] border p-2 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.38)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-3 px-1.5 pb-2">
        <div className="min-w-0">
          <h2 id="orders-kpi-heading" className="text-sm font-black text-pretty text-fg">
            תמונת מצב להזמנות
          </h2>
          <p className="text-[11px] font-semibold text-fg-muted">
            KPI ממוקד לתפעול השוטף ולעבודה מיידית
          </p>
        </div>
        <span className="rounded-full border border-subtle bg-surface-translucent-strong px-2.5 py-1 text-[10px] font-black text-fg-muted tabular-nums">
          {formatMetricCount(totalCount)} סה״כ
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <OrdersOpsKpiCard
          label="דחופות"
          value={insights.urgentCount}
          helper="לטיפול מיידי"
          tone="alert"
          className="col-span-2 md:col-span-1"
        />
        <OrdersOpsKpiCard
          label="לביצוע"
          value={insights.actionableCount}
          helper="פעולה זמינה עכשיו"
          tone="active"
        />
        <OrdersOpsKpiCard
          label="קשר מהיר"
          value={insights.contactableCount}
          helper="עם טלפון זמין"
          tone="contact"
        />
      </dl>
    </section>
  );
}
