'use client';

import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { formatNextActionWeekdayShort } from '@/src/features/ops/ui/order-card/orderCard.utils';
import { StackRow } from '@/src/ui/patterns/StackRow';
import type { OpsQueueItem } from '@/src/server/dto/ops.dto';

interface OpsQueueStackRowProps {
  /** Remaining count (excludes top-1) */
  remainingCount: number;
  rest: OpsQueueItem[];
  onItemClick?: (id: string) => void;
}

/** "+N more" expandable row for an ops queue. */
export function OpsQueueStackRow({ remainingCount, rest, onItemClick }: OpsQueueStackRowProps) {
  return (
    <StackRow
      count={remainingCount}
      items={rest.map((item) => ({
        id: item.id,
        title: item.customerName ?? DISPLAY_TEXT.unknownCustomer,
        description: item.addressLine?.trim() || DISPLAY_TEXT.noAddress,
        metaEnd: formatNextActionWeekdayShort(item.nextActionAt),
        urgent: item.isUrgent,
      }))}
      onItemClick={onItemClick}
    />
  );
}
