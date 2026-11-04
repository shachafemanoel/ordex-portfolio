'use client';

import { QueueSection } from '@/src/ui/patterns/QueueSection';
import type { OpsQueue } from '@/src/server/dto/ops.dto';

interface ShipmentsQueueListProps {
  queues: OpsQueue[];
  onItemClick?: (id: string) => void;
}

/** Renders shipment queue sections. */
export function ShipmentsQueueList({ queues, onItemClick }: ShipmentsQueueListProps) {
  const nonEmpty = queues.filter((q) => q.count > 0);

  if (nonEmpty.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No shipments in queue
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {nonEmpty.map((queue) => (
        <QueueSection
          key={queue.key}
          title={queue.title}
          count={queue.count}
          top={queue.top}
          rest={queue.rest}
          scope="shipments"
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
}
