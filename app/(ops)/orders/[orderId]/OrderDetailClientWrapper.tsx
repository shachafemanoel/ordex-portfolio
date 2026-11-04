'use client';

import { MobileOrderDetail } from '@/components/orders/MobileOrderDetail';

import type { OrderWithRelations } from '@/lib/api/types';
import { Suspense } from 'react';

interface OrderDetailClientWrapperProps {
  initialOrder: OrderWithRelations;
}

export function OrderDetailClientWrapper({ initialOrder }: OrderDetailClientWrapperProps) {
  return (
    <Suspense fallback={null}>
      <MobileOrderDetail order={initialOrder} />
    </Suspense>
  );
}
