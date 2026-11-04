'use client';

import { OrderSummaryCard } from '@/components/orders/shared/OrderSummaryCard';
import type { OrderOpsData, OpsItem } from '../workflow/types';

interface OrderOverviewCardProps {
  orderData: OrderOpsData;
  items: OpsItem[];
}

export function OrderOverviewCard({ orderData, items }: Readonly<OrderOverviewCardProps>) {
  const allocatedCount = items.filter(
    (i) => i.allocationStatus === 'ALLOCATED' || i.received
  ).length;
  const itemsSummary =
    items.length === 0
      ? 'ללא פריטים'
      : allocatedCount === items.length
        ? `${items.length} פריטים — הכל מוכן`
        : `${items.length} פריטים — ${allocatedCount} מוכנים`;

  return <OrderSummaryCard order={orderData} itemsCount={items.length} itemsSummary={itemsSummary} />;
}
