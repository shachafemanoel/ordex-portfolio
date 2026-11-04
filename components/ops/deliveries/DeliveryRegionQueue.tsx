'use client';

import { cn } from '@/lib/utils';
import { CheckSquare, ChevronDown, ChevronUp, Loader2, Navigation, Phone, Square } from 'lucide-react';
import { useState } from 'react';
import { buildNavigationHref, buildPhoneHref, formatClockTime, type DeliveryBoardItem } from './types';

// ---------------------------------------------------------------------------
// Priority helpers
// ---------------------------------------------------------------------------

type TimePriority = 'urgent' | 'soon' | 'scheduled' | 'none';

function getTimePriority(scheduledAt: string | null): TimePriority {
  if (!scheduledAt) return 'none';
  const diffMinutes = (new Date(scheduledAt).getTime() - Date.now()) / 60_000;
  if (diffMinutes < 0) return 'urgent';
  if (diffMinutes < 60) return 'soon';
  return 'scheduled';
}

const PRIORITY_BADGE: Record<TimePriority, { badgeClass: string; label: (t: string | null) => string }> = {
  urgent: {
    badgeClass: 'bg-red-100 text-red-700 border border-red-200',
    label: (t) => (t ? `⚡ ${t}` : '⚡ באיחור'),
  },
  soon: {
    badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
    label: (t) => (t ? `⏰ ${t}` : '⏰ בקרוב'),
  },
  scheduled: {
    badgeClass: 'bg-blue-50 text-primary-600 border border-blue-100',
    label: (t) => (t ? `🕐 ${t}` : '🕐 מתוזמן'),
  },
  none: {
    badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
    label: () => 'ללא שעה',
  },
};

// ---------------------------------------------------------------------------
// Region grouping logic
// ---------------------------------------------------------------------------

interface RegionGroup {
  city: string;
  items: DeliveryBoardItem[];
  earliestScheduledAt: string | null;
  urgentCount: number;
  soonCount: number;
}

function sortByTime(items: DeliveryBoardItem[]): DeliveryBoardItem[] {
  return [...items].sort((a, b) => {
    if (!a.scheduledAt && !b.scheduledAt) return 0;
    if (!a.scheduledAt) return 1;
    if (!b.scheduledAt) return -1;
    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
  });
}

function groupByRegion(deliveries: DeliveryBoardItem[]): RegionGroup[] {
  const map = new Map<string, DeliveryBoardItem[]>();

  for (const delivery of deliveries) {
    const city = delivery.city?.trim() || 'ללא אזור';
    if (!map.has(city)) map.set(city, []);
    map.get(city)!.push(delivery);
  }

  const groups: RegionGroup[] = [];

  for (const [city, items] of map) {
    const sorted = sortByTime(items);
    const scheduled = sorted.filter((i) => i.scheduledAt);
    const urgentCount = sorted.filter((i) => getTimePriority(i.scheduledAt) === 'urgent').length;
    const soonCount = sorted.filter((i) => getTimePriority(i.scheduledAt) === 'soon').length;

    groups.push({
      city,
      items: sorted,
      earliestScheduledAt: scheduled[0]?.scheduledAt ?? null,
      urgentCount,
      soonCount,
    });
  }

  // Sort regions: most urgent first, then earliest scheduled, then alphabetical
  groups.sort((a, b) => {
    if (a.urgentCount !== b.urgentCount) return b.urgentCount - a.urgentCount;
    if (a.soonCount !== b.soonCount) return b.soonCount - a.soonCount;
    if (a.earliestScheduledAt && b.earliestScheduledAt) {
      return (
        new Date(a.earliestScheduledAt).getTime() - new Date(b.earliestScheduledAt).getTime()
      );
    }
    if (a.earliestScheduledAt) return -1;
    if (b.earliestScheduledAt) return 1;
    return a.city.localeCompare(b.city, 'he');
  });

  return groups;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TRANSIT_FOR_BADGE = new Set(['IN_TRANSIT', 'INSTALLATION']);

export interface DeliveryRegionQueueProps {
  deliveries: DeliveryBoardItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onOpenDelivery: (delivery: DeliveryBoardItem) => void;
  isFreeRoutePending?: boolean;
  onStartFreeRoute?: () => void;
  /** טקסט לכפתור התחתון (ברירת מחדל: צור מסלול) */
  primaryActionLabel?: string;
}

export function DeliveryRegionQueue({
  deliveries,
  selectedIds,
  onToggle,
  onOpenDelivery,
  isFreeRoutePending,
  onStartFreeRoute,
  primaryActionLabel,
}: DeliveryRegionQueueProps) {
  const [collapsedCities, setCollapsedCities] = useState<Set<string>>(new Set());

  const selectedSet = new Set(selectedIds);
  const regionGroups = groupByRegion(deliveries);

  const handleToggleRegion = (items: DeliveryBoardItem[]) => {
    const regionIds = items.map((i) => i.id);
    const allSelected = regionIds.every((id) => selectedSet.has(id));
    for (const id of regionIds) {
      const isSelected = selectedSet.has(id);
      if (allSelected ? isSelected : !isSelected) {
        onToggle(id);
      }
    }
  };

  const toggleCollapse = (city: string) => {
    setCollapsedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  };

  if (deliveries.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm font-semibold text-slate-400">
        אין הזמנות מוכנות לאיסוף
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-20">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
          תור לפי אזורים
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
          {deliveries.length} הזמנות • {regionGroups.length} אזורים
        </span>
      </div>

      {/* Region groups */}
      {regionGroups.map((group) => {
        const isCollapsed = collapsedCities.has(group.city);
        const regionIds = group.items.map((i) => i.id);
        const allSelected = regionIds.every((id) => selectedSet.has(id));
        const someSelected = regionIds.some((id) => selectedSet.has(id));
        const selectedInRegion = regionIds.filter((id) => selectedSet.has(id)).length;
        const isUrgent = group.urgentCount > 0;
        const isSoon = !isUrgent && group.soonCount > 0;
        const earliestTime = formatClockTime(group.earliestScheduledAt);

        return (
          <div
            key={group.city}
            className={cn(
              'overflow-hidden rounded-[24px] border bg-white shadow-sm',
              isUrgent
                ? 'border-red-200'
                : isSoon
                  ? 'border-amber-200'
                  : 'border-slate-200'
            )}
          >
            {/* Region header */}
            <div
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                isUrgent
                  ? 'bg-red-50/70'
                  : isSoon
                    ? 'bg-amber-50/70'
                    : 'bg-slate-50/80'
              )}
            >
              {/* Select-all checkbox */}
              <button
                type="button"
                onClick={() => handleToggleRegion(group.items)}
                className="shrink-0"
                aria-label={allSelected ? 'בטל בחירת כל האזור' : 'בחר את כל האזור'}
              >
                {allSelected ? (
                  <CheckSquare className="h-5 w-5 text-[#0056b3]" />
                ) : someSelected ? (
                  <CheckSquare className="h-5 w-5 text-[#0056b3]/40" />
                ) : (
                  <Square className="h-5 w-5 text-slate-300" />
                )}
              </button>

              {/* City & meta */}
              <button
                type="button"
                onClick={() => toggleCollapse(group.city)}
                className="flex min-w-0 flex-1 items-center gap-2 text-right"
              >
                <span className="truncate text-sm font-black text-slate-900">{group.city}</span>

                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-black',
                    selectedInRegion > 0
                      ? 'bg-primary-600 text-on-dark'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
                  )}
                >
                  {selectedInRegion > 0
                    ? `${selectedInRegion}/${group.items.length}`
                    : group.items.length}
                </span>

                {group.urgentCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700">
                    {group.urgentCount} באיחור
                  </span>
                )}
                {group.soonCount > 0 && group.urgentCount === 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-700">
                    {group.soonCount} בקרוב
                  </span>
                )}
                {earliestTime && (
                  <span className="hidden rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-500 sm:inline">
                    מ-{earliestTime}
                  </span>
                )}
              </button>

              {/* Collapse toggle */}
              <button
                type="button"
                onClick={() => toggleCollapse(group.city)}
                className="shrink-0 text-slate-400 hover:text-slate-600"
                aria-label={isCollapsed ? 'הרחב אזור' : 'כווץ אזור'}
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Delivery rows */}
            {!isCollapsed && (
              <div className="divide-y divide-slate-100">
                {group.items.map((delivery) => {
                  const isSelected = selectedSet.has(delivery.id);
                  const priority = getTimePriority(delivery.scheduledAt);
                  const { badgeClass, label } = PRIORITY_BADGE[priority];
                  const timeLabel = formatClockTime(delivery.scheduledAt);
                  const needsCoordination =
                    !delivery.scheduledAt && !TRANSIT_FOR_BADGE.has(delivery.status);
                  const navHref = buildNavigationHref(delivery);
                  const phoneHref = buildPhoneHref(delivery.customerPhone);

                  return (
                    <div
                      key={delivery.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 transition-colors',
                        isSelected && 'bg-blue-50/50'
                      )}
                    >
                      {/* Row checkbox */}
                      <button
                        type="button"
                        onClick={() => onToggle(delivery.id)}
                        className="shrink-0"
                        aria-label={isSelected ? 'בטל בחירה' : 'בחר הזמנה'}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-[#0056b3]" />
                        ) : (
                          <Square className="h-5 w-5 text-slate-300 hover:text-slate-400" />
                        )}
                      </button>

                      {/* Time priority badge */}
                      {needsCoordination ? (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-900">
                          נדרש לתאם שעה
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black',
                            badgeClass
                          )}
                        >
                          {label(timeLabel)}
                        </span>
                      )}

                      {/* Delivery info */}
                      <button
                        type="button"
                        onClick={() => onOpenDelivery(delivery)}
                        className="min-w-0 flex-1 text-right"
                      >
                        <div className="truncate text-sm font-black text-slate-900">
                          {delivery.customerName}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold text-slate-500">
                            {delivery.addressLine}
                          </span>
                          {delivery.itemsCount ? (
                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600">
                              {delivery.itemsCount}×
                            </span>
                          ) : null}
                        </div>
                      </button>

                      {/* Action buttons */}
                      <div className="flex shrink-0 items-center gap-1">
                        {phoneHref ? (
                          <a
                            href={phoneHref}
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            aria-label="התקשר ללקוח"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        <a
                          href={navHref}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-500 text-on-dark shadow-sm hover:bg-primary-600"
                          aria-label="נווט לכתובת"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Start route CTA — sticky at bottom */}
      {onStartFreeRoute ? (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:static sm:mt-2 sm:border-t-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button
            type="button"
            disabled={selectedIds.length === 0 || isFreeRoutePending}
            onClick={onStartFreeRoute}
            className={cn(
              'flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 font-black text-on-dark shadow-lg transition-all',
              (selectedIds.length === 0 || isFreeRoutePending) && 'cursor-not-allowed opacity-50'
            )}
          >
            {isFreeRoutePending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                מחשב מסלול אופטימלי...
              </>
            ) : selectedIds.length > 0 ? (
              <>
                <Navigation className="h-5 w-5" />
                {primaryActionLabel
                  ? `${primaryActionLabel} • ${selectedIds.length} הזמנות`
                  : `צור מסלול • ${selectedIds.length} הזמנות נבחרו`}
              </>
            ) : (
              <>
                <Navigation className="h-5 w-5" />
                בחר הזמנות להתחלת מסלול
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
