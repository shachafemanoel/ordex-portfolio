import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { getEntityToneDotClass, getOrderStatusDisplay } from '@/components/shared/display/displayStatus';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_FLOW } from '@/lib/orderStatus';
import type { OrderStatus } from '@prisma/client';

const STEP_INDEX: Partial<Record<OrderStatus, number>> = Object.fromEntries(
  ORDER_STATUS_FLOW.map((s, i) => [s, i + 1])
);

interface OrderStatusBadgeProps {
  status: OrderStatus;
  showStep?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function OrderStatusBadge({
  status,
  showStep = false,
  size = 'md',
  className,
}: OrderStatusBadgeProps) {
  const display = getOrderStatusDisplay(status);
  const step = STEP_INDEX[status];

  return (
    <EntityBadge
      label={showStep && step ? `שלב ${step}: ${display.label}` : display.label}
      tone={display.tone}
      size={size}
      dotClassName={getEntityToneDotClass(display.tone)}
      className={cn(className)}
    />
  );
}

interface OrderStatusArrowProps {
  from: OrderStatus;
  to: OrderStatus;
  className?: string;
}

export function OrderStatusArrow({ from, to, className }: OrderStatusArrowProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} dir="rtl">
      <OrderStatusBadge status={from} />
      <span className="text-sm text-slate-400">←</span>
      <OrderStatusBadge status={to} />
    </div>
  );
}
