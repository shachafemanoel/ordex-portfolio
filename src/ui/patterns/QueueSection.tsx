import { OpsQueueStackRow } from '@/src/features/ops/ui/OpsQueueStackRow';
import { ShipmentsQueueStackRow } from '@/src/features/shipments/ui/ShipmentsQueueStackRow';
import { OrderCard } from '@/src/features/ops/ui/OrderCard';
import type { OpsQueueItem } from '@/src/server/dto/ops.dto';
import { QueueSectionHeader } from '@/src/ui/patterns/QueueSectionHeader';

interface QueueSectionProps {
  title: string;
  count: number;
  top: OpsQueueItem | null;
  rest: OpsQueueItem[];
  /** `shipments` = same compact card layout as orders board (address-first header) */
  scope?: 'orders' | 'shipments';
  onItemClick?: (id: string) => void;
  onRefresh?: () => void;
}

/**
 * Renders a single queue: header + OrderCard (rich card) for the top item + collapsible stack row.
 */
export function QueueSection({
  title,
  count,
  top,
  rest,
  scope = 'orders',
  onItemClick,
  onRefresh,
}: QueueSectionProps) {
  if (count === 0 || !top) return null;

  const remainingCount = count - 1;
  const urgentCount = [top, ...rest].filter((item) => item.isUrgent).length;
  const isShipments = scope === 'shipments';

  return (
    <section className="divide-line-y space-y-0 rounded-2xl border border-[color:var(--color-border-primary)] bg-surface p-3 shadow-sm sm:p-4">
      <div className="pb-3">
        <QueueSectionHeader title={title} count={count} urgentCount={urgentCount} />
      </div>

      <div className="space-y-3 pt-3">
      <OrderCard
        {...top}
        onClick={onItemClick}
        onRefresh={onRefresh}
        displayVariant={isShipments ? 'shipments' : 'orders'}
      />

      {remainingCount > 0 &&
        (isShipments ? (
          <ShipmentsQueueStackRow
            remainingCount={remainingCount}
            rest={rest}
            onItemClick={onItemClick}
          />
        ) : (
          <OpsQueueStackRow remainingCount={remainingCount} rest={rest} onItemClick={onItemClick} />
        ))}
      </div>
    </section>
  );
}
