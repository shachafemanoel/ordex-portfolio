'use client';

import { EntityActionButton, EntityBadge, EntityField } from '@/components/shared/display/EntityPrimitives';
import { getEntityToneDotClass } from '@/components/shared/display/displayStatus';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { cn } from '@/lib/utils';
import type { OpsQueueItem } from '@/src/server/dto/ops.dto';
import { MapPin, Package } from 'lucide-react';
import { useState } from 'react';

interface ShipmentsQueueCardProps extends OpsQueueItem {
  onClick?: (id: string) => void;
}

/** Shipment card: tap card header to expand items (no separate chevron). */
export function ShipmentsQueueCard({
  id,
  customerName,
  addressLine,
  itemLabels,
  itemsSummary,
  itemsCount,
  onClick,
}: ShipmentsQueueCardProps) {
  const [itemsOpen, setItemsOpen] = useState(false);
  const safeItemLabels = Array.isArray(itemLabels)
    ? itemLabels.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];
  const itemCount = typeof itemsCount === 'number' && itemsCount > 0 ? itemsCount : safeItemLabels.length;
  const itemCountLabel = `${itemCount} ${DISPLAY_TEXT.items}`;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={itemsOpen}
      onClick={() => setItemsOpen((open) => !open)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setItemsOpen((open) => !open);
        }
      }}
      className={cn(
        'w-full cursor-pointer rounded-[18px] border border-subtle bg-surface text-right shadow-sm transition-all',
        'hover:border-subtle-light hover:shadow-md',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35 focus-visible:ring-offset-2'
      )}
    >
      <div className="overflow-hidden p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-fg">
              {customerName ?? DISPLAY_TEXT.unknownCustomer}
            </p>
            <div className="mt-2 grid gap-2">
              <EntityField
                icon={MapPin}
                label={DISPLAY_TEXT.address}
                value={addressLine?.trim() || DISPLAY_TEXT.noAddress}
                tone="neutral"
              />
            </div>
          </div>
          <EntityBadge
            label={itemCountLabel}
            tone="neutral"
            dotClassName={getEntityToneDotClass('neutral')}
            className="shrink-0"
          />
        </div>

        {itemsOpen ? (
          <div
            className="mt-3 border-t border-subtle pt-3"
            onClick={(event) => event.stopPropagation()}
          >
            <EntityField
              icon={Package}
              label={DISPLAY_TEXT.items}
              value={itemsSummary ?? itemCountLabel}
              tone="info"
              className="mb-3"
            />
            {safeItemLabels.length > 0 ? (
              <ul className="space-y-1.5">
                {safeItemLabels.map((item, index) => (
                  <li key={`${item}-${index}`} className="truncate text-sm text-fg-muted">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">{itemsSummary ?? DISPLAY_TEXT.noItems}</p>
            )}

            {onClick ? (
              <EntityActionButton
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClick(id);
                }}
                className="mt-3 h-9 px-3 text-xs"
              >
                {DISPLAY_TEXT.openShipment}
              </EntityActionButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
