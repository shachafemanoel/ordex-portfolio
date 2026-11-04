'use client';

import { haversineKm } from '@/lib/geo/haversineKm';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

type LocatorItem = {
  id: string;
  title: string;
  subtitle: string;
  lat: number | null;
  lng: number | null;
  statusLabel?: string | null;
};

export function StoreLocatorMapPreset({
  items,
  userLocation,
  selectedItemId,
  onSelect,
  renderMap,
  className,
  sortByDistance = true,
}: {
  items?: LocatorItem[] | null;
  userLocation?: { lat: number; lng: number } | null;
  selectedItemId?: string | null;
  onSelect?: (itemId: string) => void;
  renderMap: () => ReactNode;
  className?: string;
  sortByDistance?: boolean;
}) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const sortedItems = useMemo(() => {
    const copy = [...safeItems];
    if (!sortByDistance || !userLocation) return copy;

    return copy.sort((a, b) => {
      const aValid = typeof a.lat === 'number' && typeof a.lng === 'number';
      const bValid = typeof b.lat === 'number' && typeof b.lng === 'number';
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;
      const da = haversineKm(userLocation, { lat: a.lat!, lng: a.lng! });
      const db = haversineKm(userLocation, { lat: b.lat!, lng: b.lng! });
      return da - db;
    });
  }, [safeItems, sortByDistance, userLocation]);

  return (
    <div className={cn('grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[340px_minmax(0,1fr)]', className)}>
      <aside className="min-h-[220px] overflow-auto rounded-[18px] border border-subtle bg-surface p-2">
        <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
          רשימת נקודות
        </div>
        <div className="space-y-1">
          {sortedItems.map((item) => {
            const active = item.id === selectedItemId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect?.(item.id)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2 text-right transition',
                  active
                    ? 'border-brand-soft bg-info-soft'
                    : 'border-transparent bg-surface-page-wash/50 hover:border-subtle hover:bg-surface-muted'
                )}
              >
                <div className="truncate text-sm font-bold text-fg">{item.title}</div>
                <div className="truncate text-xs text-fg-muted" dir="auto">
                  {item.subtitle}
                </div>
                {item.statusLabel ? (
                  <div className="mt-1 text-[10px] font-bold text-fg-subtle">{item.statusLabel}</div>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>
      <div className="min-h-[260px]">{renderMap()}</div>
    </div>
  );
}
