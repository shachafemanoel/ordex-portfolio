'use client';

import { QueueSection } from '@/src/ui/patterns/QueueSection';
import type { OpsQueue } from '@/src/server/dto/ops.dto';

interface OpsQueueListProps {
  queues: OpsQueue[];
  onItemClick?: (id: string) => void;
}

/** Renders a vertical list of queue sections. Only shows queues with count > 0. */
export function OpsQueueList({ queues, onItemClick }: OpsQueueListProps) {
  const nonEmpty = queues.filter((q) => q.count > 0);

  if (nonEmpty.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No items in this view
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
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
}
