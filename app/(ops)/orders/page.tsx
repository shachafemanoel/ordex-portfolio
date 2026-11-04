'use client';

import { OrdersOpsBoardContent } from '@/components/orders/ops-board/OrdersOpsBoardContent';
import { OrdersOpsHeader } from '@/components/orders/ops-board/OrdersOpsHeader';
import { useOrdersOpsBoard } from '@/components/orders/ops-board/useOrdersOpsBoard';
import OrderOpsFloatingModal from '@/components/orders/ops/OrderOpsFloatingModal';
import { useRBAC } from '@/hooks/useRBAC';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
export default function OrdersPage() {
  const { t, direction } = useUITranslation();
  const { hasPermission } = useRBAC();
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    selectedOrderId,
    setSelectedOrderId,
    filteredQueues,
    totalCount,
    insights,
    clearSearch,
    isBusy,
    isLoading,
    refetch,
    error,
  } = useOrdersOpsBoard();

  return (
    <div className="min-h-full space-y-3 pb-24" dir={direction}>
      <OrdersOpsHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={clearSearch}
        onRefresh={() => void refetch()}
        isBusy={isBusy}
        totalCount={totalCount}
        insights={insights}
        canCreateOrder={hasPermission('CREATE_ORDERS')}
      />

      <div className="space-y-3 px-3 sm:px-4">
        <OrdersOpsBoardContent
          error={error}
          isLoading={isLoading}
          queues={filteredQueues}
          searchQuery={searchQuery}
          onRetry={() => void refetch()}
          onClearSearch={clearSearch}
          onItemClick={setSelectedOrderId}
          onRefresh={() => void refetch()}
          emptyStateLabel={t('orders.emptyState')}
          clearSearchLabel={t('orders.clearSearch')}
        />
      </div>

      <OrderOpsFloatingModal
        open={!!selectedOrderId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrderId(null);
            void refetch();
          }
        }}
        orderId={selectedOrderId}
        initialOrder={null}
      />
    </div>
  );
}
