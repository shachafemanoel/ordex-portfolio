'use client';

import { OrderCard, OrderSummaryData } from '@/components/ops/shared/OrderCard';

export interface OpsGridOrder extends OrderSummaryData {}

interface OrdersGridProps {
  orders: OpsGridOrder[];
  onSelect: (id: string) => void;
}

export function OrdersGrid({ orders, onSelect }: OrdersGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onClick={() => onSelect(order.id)}
        />
      ))}
    </div>
  );
}
