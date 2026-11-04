'use client';

import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { formatNextActionTimeOnly } from '@/src/features/ops/ui/order-card/orderCard.utils';
import { StackRow } from '@/src/ui/patterns/StackRow';
import type { OpsQueueItem } from '@/src/server/dto/ops.dto';

interface ShipmentsQueueStackRowProps {
  remainingCount: number;
  rest: OpsQueueItem[];
  onItemClick?: (id: string) => void;
}

/** "+N more" stack row for shipments queues. */
export function ShipmentsQueueStackRow({
  remainingCount,
  rest,
  onItemClick,
}: ShipmentsQueueStackRowProps) {
  return (
    <StackRow
      count={remainingCount}
      items={rest.map((item) => ({
        id: item.id,
        title: item.addressLine?.trim() || DISPLAY_TEXT.noAddress,
        description: item.customerName?.trim() || DISPLAY_TEXT.unknownCustomer,
        metaEnd: formatNextActionTimeOnly(item.nextActionAt),
        urgent: item.isUrgent,
      }))}
      onItemClick={onItemClick}
    />
  );
}
