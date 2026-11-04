'use client';

import { EntitySurface } from '@/components/shared/display/EntityPrimitives';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { cn } from '@/lib/utils';

interface OrderItemsSummaryCardProps {
  summary?: string | null;
  items: string[];
  className?: string;
}

export function OrderItemsSummaryCard({
  summary,
  items,
  className,
}: Readonly<OrderItemsSummaryCardProps>) {
  const hasItems = items.length > 0;

  return (
    <EntitySurface className={cn('border-subtle bg-surface-muted/40', className)}>
      <div className="p-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-fg-subtle">
          {DISPLAY_TEXT.usefulDetails}
        </div>
        {summary ? (
          <p className="mt-2 rounded-xl border border-subtle bg-surface px-3 py-2 text-[13px] font-semibold text-fg-muted shadow-sm">
            {summary}
          </p>
        ) : null}
        {hasItems ? (
          <ul className="mt-2 space-y-2">
            {items.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="rounded-xl border border-subtle bg-surface px-3 py-2 text-[14px] font-medium leading-6 text-fg-muted shadow-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : !summary ? (
          <p className="mt-2 text-[14px] font-medium text-fg-muted">{DISPLAY_TEXT.noItems}</p>
        ) : null}
      </div>
    </EntitySurface>
  );
}
