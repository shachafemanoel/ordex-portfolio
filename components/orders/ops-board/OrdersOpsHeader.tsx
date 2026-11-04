'use client';

import { OpsCompactHeader } from '@/components/ops/shared/OpsBoardPrimitives';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { OpsTab } from '@/src/server/dto/ops.dto';
import { Download, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { OrdersOpsMetrics } from './OrdersOpsMetrics';
import { OrdersOpsSearchInput } from './OrdersOpsSearchInput';
import { OrdersOpsTabs } from './OrdersOpsTabs';
import type { OrdersOpsInsights } from './useOrdersOpsBoard';

interface OrdersOpsHeaderProps {
  activeTab: OpsTab;
  onTabChange: (tab: OpsTab) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onRefresh: () => void;
  isBusy: boolean;
  totalCount: number;
  insights: OrdersOpsInsights;
  canCreateOrder: boolean;
}

export function OrdersOpsHeader({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onRefresh,
  isBusy,
  totalCount,
  insights,
  canCreateOrder,
}: Readonly<OrdersOpsHeaderProps>) {
  const { t } = useUITranslation();

  const headerTitle = t('orders.headerTitleWithCount', undefined, {
    params: { title: t('orders.title'), count: String(totalCount) },
  });

  return (
    <OpsCompactHeader
      title={headerTitle}
      subtitle={isBusy ? <span className="text-ops-icon-muted">מתעדכן...</span> : null}
      actions={
        <>
          <a
            href="/api/orders/export"
            download
            className="inline-flex h-10 items-center gap-2 rounded-full border border-surface-soft bg-surface-translucent px-3 text-sm font-bold text-ops-muted backdrop-blur-md transition-all hover:bg-surface-translucent-strong hover:text-brand sm:px-4"
            title="ייצוא הזמנות ל-CSV (עד 5000 שורות)"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">ייצוא</span>
          </a>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-surface-soft bg-surface-translucent px-4 text-sm font-bold text-brand backdrop-blur-md transition-all active:scale-95 hover:bg-surface-translucent-strong hover:shadow-sm"
          >
            <RefreshCw className={cn('h-4 w-4', isBusy && 'animate-spin')} />
            <span className="hidden sm:inline">רענן</span>
          </button>
          {canCreateOrder ? (
            <Link
              href="/orders/new"
              aria-label={t('orders.newOrder')}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-gradient px-3 text-sm font-bold text-on-inverse shadow-md shadow-primary-500/30 transition-all active:scale-95 hover:shadow-lg hover:shadow-primary-500/40 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              {/* Phones keep the title readable; the mobile bar has its own new-order button. */}
              <span className="hidden sm:inline">{t('orders.newOrder')}</span>
            </Link>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <OrdersOpsTabs activeTab={activeTab} onTabChange={onTabChange} />
        <OrdersOpsSearchInput
          value={searchQuery}
          placeholder={t('orders.searchPlaceholder')}
          onChange={onSearchChange}
          onClear={onClearSearch}
        />
        <OrdersOpsMetrics totalCount={totalCount} insights={insights} />
      </div>
    </OpsCompactHeader>
  );
}
