'use client';

import { EntityField, EntityNotice, EntitySurface } from '@/components/shared/display/EntityPrimitives';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { AlertCircle, Truck } from 'lucide-react';

import { DeliveryRegionQueue } from './DeliveryRegionQueue';
import {
  formatDistanceLabel,
  formatDurationLabel,
  type ChecklistStateByRouteId,
  type DeliveryBoardItem,
  type DeliveryRouteGroupView,
} from './types';

interface PickupBoardProps {
  allPickupDeliveries: DeliveryBoardItem[];
  freeSelectedIds: string[];
  freeSelectionMode: boolean;
  isFreeRoutePending: boolean;
  onStartFreeRoute: () => void;
  onToggleFreeDelivery: (id: string) => void;
  onToggleFreeSelectionMode: () => void;
  activeEtaCount: number;
  activeGeocodedCount: number;
  activeRouteCountLabel: string;
  activeRouteDistanceLabel: string | null;
  activeRouteDurationLabel: string | null;
  activeRouteGroup: DeliveryRouteGroupView | null;
  activeWorkloadLabel: string | null;
  assignPending: boolean;
  completedStopIdsByRouteId: ChecklistStateByRouteId;
  currentUserId: string | null;
  currentUserName: string | null;
  deferredDateLabel: string | null;
  deferredRouteWorkloadLabel: string | null;
  deliveryTaskPending: boolean;
  errorMessage: string | null;
  hasDeferredRoute: boolean;
  isExecutionMode: boolean;
  isStatusChanging: (orderId: string) => boolean;
  mounted: boolean;
  multiRouteMode: boolean;
  onClearRouteGroupFocus: () => void;
  onMarkDelivered: (orderId: string) => void;
  onSelectDelivery: (
    delivery: DeliveryBoardItem,
    options?: {
      openModal?: boolean;
    }
  ) => void;
  onSelectRouteGroup: (groupId: string) => void;
  onStartDelivery: (orderId: string) => void;
  onTakeRoute: (groupId: string) => void;
  onTogglePickupItem: (routeId: string, itemId: string) => void;
  originTimelineLabel: string;
  pickupChecklistByRouteId: ChecklistStateByRouteId;
  plannedActiveDeliveriesCount: number;
  routeCapacityLabel: string | null;
  routeCards: DeliveryRouteGroupView[];
  routeGroupsAvailable: boolean;
  routeOperationalLimitLabel: string | null;
  routePanelsCount: number;
  routePreSplitWorkloadLabel: string | null;
  routeSummaryBusinessHoursLabel: string | null;
  routeSummaryDeferredStopCount: number;
  routeSummaryExceedsBusinessHours: boolean;
  routeSummaryExceedsOperationalLimit: boolean;
  routeSummaryOverflowLabel: string | null;
  routeWorkloadLabel: string | null;
  scopedVisibleDeliveries: DeliveryBoardItem[];
  selectedDeliveryId: string | null;
  selectedRouteDateLabel: string;
  showBoardInfo: boolean;
  /** דשבורד ניהול משלוחים: ללא שורות מסלול אוטומטיות — רק בחירה לפי אזורים */
  hideSystemRouteRows?: boolean;
  emptyQueueLabel?: string | null;
  dashboardPreviewSeconds?: number;
  onCancelDashboardPreview?: () => void;
  onCommitDashboardRoute?: () => void;
  routePlanPrimaryLabel?: string;
}

export function PickupBoard({
  allPickupDeliveries,
  freeSelectedIds,
  freeSelectionMode,
  isFreeRoutePending,
  onStartFreeRoute,
  onToggleFreeDelivery,
  onToggleFreeSelectionMode,
  activeEtaCount,
  activeGeocodedCount,
  activeRouteCountLabel,
  activeRouteDistanceLabel,
  activeRouteDurationLabel,
  activeRouteGroup,
  activeWorkloadLabel,
  assignPending,
  completedStopIdsByRouteId,
  currentUserId,
  currentUserName,
  deferredDateLabel,
  deferredRouteWorkloadLabel,
  deliveryTaskPending,
  errorMessage,
  hasDeferredRoute,
  isExecutionMode,
  isStatusChanging,
  mounted,
  multiRouteMode,
  onClearRouteGroupFocus,
  onMarkDelivered,
  onSelectDelivery,
  onSelectRouteGroup,
  onStartDelivery,
  onTakeRoute,
  onTogglePickupItem,
  originTimelineLabel,
  pickupChecklistByRouteId,
  plannedActiveDeliveriesCount,
  routeCapacityLabel,
  routeCards,
  routeGroupsAvailable,
  routeOperationalLimitLabel,
  routePanelsCount,
  routePreSplitWorkloadLabel,
  routeSummaryBusinessHoursLabel,
  routeSummaryDeferredStopCount,
  routeSummaryExceedsBusinessHours,
  routeSummaryExceedsOperationalLimit,
  routeSummaryOverflowLabel,
  routeWorkloadLabel,
  scopedVisibleDeliveries,
  selectedDeliveryId,
  selectedRouteDateLabel,
  showBoardInfo,
  hideSystemRouteRows = false,
  emptyQueueLabel = null,
  dashboardPreviewSeconds = 0,
  onCancelDashboardPreview,
  onCommitDashboardRoute,
  routePlanPrimaryLabel,
}: Readonly<PickupBoardProps>) {
  const showRegionQueue =
    plannedActiveDeliveriesCount > 0 && (hideSystemRouteRows || !routeGroupsAvailable);

  return (
    <aside
      className={cn(
        'surface-deliveries-aside z-20 flex min-h-[480px] flex-col overflow-hidden rounded-3xl border-0 bg-surface/90 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.22)] ring-1 ring-[color:var(--color-border-primary)] backdrop-blur-xl sm:min-h-[560px] xl:h-[calc(100vh-14rem)] xl:max-h-[800px]',
        isExecutionMode && 'hidden'
      )}
    >
      <div className="flex-1 space-y-8 overflow-y-auto p-4 sm:p-6">
        {freeSelectedIds.length > 0 ? (
          <div className="flex shrink-0 justify-end">
            <span className="rounded-full bg-brand-solid px-3 py-1.5 text-xs font-black text-on-inverse">
              {freeSelectedIds.length} נבחרו
            </span>
          </div>
        ) : null}
        {errorMessage ? (
          <EntityNotice icon={AlertCircle} tone="warning" title={errorMessage} />
        ) : null}

        {dashboardPreviewSeconds > 0 && onCancelDashboardPreview && onCommitDashboardRoute ? (
          <div className="tone-accent rounded-[22px] border p-4 shadow-sm">
            <div className="text-sm font-black text-fg">תצוגה מקדימה של המסלול</div>
            <p className="mt-1 text-xs font-semibold text-fg-muted">
              המפה מעודכנת. מעבר אוטומטי לנסיעה פעילה בעוד {dashboardPreviewSeconds} שניות — או אשר
              מיד.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                className="rounded-full bg-accent font-black text-on-inverse hover:bg-accent-deep"
                onClick={onCommitDashboardRoute}
              >
                התחל נסיעה עכשיו
              </Button>
              <Button type="button" variant="outline" className="rounded-full font-bold" onClick={onCancelDashboardPreview}>
                ביטול
              </Button>
            </div>
          </div>
        ) : null}

        {showBoardInfo ? (
          <div className="mb-4 grid gap-2">
            <div className="hidden grid-cols-2 gap-2 lg:grid">
              <div className="rounded-2xl border border-subtle bg-surface p-3 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                  ETA מחושבים
                </div>
                <div className="mt-1 text-lg font-black text-fg">{activeEtaCount}</div>
              </div>
              <div className="rounded-2xl border border-subtle bg-surface p-3 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                  כתובות הושלמו
                </div>
                <div className="mt-1 text-lg font-black text-fg">{activeGeocodedCount}</div>
              </div>
            </div>
            <div className="hidden grid-cols-2 gap-2 lg:grid">
              <div className="rounded-2xl border border-subtle bg-surface p-3 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                  קיבולת יום
                </div>
                <div className="mt-1 text-lg font-black text-fg">
                  {routeCapacityLabel ?? routeSummaryBusinessHoursLabel ?? 'לא הוגדר'}
                </div>
              </div>
              <div className="rounded-2xl border border-subtle bg-surface p-3 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                  עומס מתוכנן
                </div>
                <div className="mt-1 text-lg font-black text-fg">
                  {activeWorkloadLabel ?? activeRouteDurationLabel ?? 'לא חושב'}
                </div>
              </div>
            </div>
            <div className="hidden grid-cols-2 gap-2 lg:grid">
              <div className="rounded-2xl border border-subtle bg-surface p-3 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                  תקרת מסלול
                </div>
                <div className="mt-1 text-lg font-black text-fg">
                  {routeOperationalLimitLabel ?? "10 ש'"}
                </div>
              </div>
              <div className="rounded-2xl border border-subtle bg-surface p-3 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                  מסלול נדחה
                </div>
                <div className="mt-1 text-lg font-black text-fg">
                  {hasDeferredRoute ? `${routeSummaryDeferredStopCount} עצירות` : 'ללא'}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!mounted ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((index) => (
              <div key={index} className="h-48 rounded-[24px] bg-surface-highlight" />
            ))}
          </div>
        ) : plannedActiveDeliveriesCount > 0 ? (
          <div className="space-y-6">
            {!hideSystemRouteRows && routeGroupsAvailable ? (
              <div className="space-y-3">
                <EntitySurface className="px-4 py-4 shadow-sm">
                  <div className="text-sm font-black text-fg">
                    {multiRouteMode ? 'שורות איסוף לפי אזור' : 'איסוף יומי'}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-fg-muted">
                    {multiRouteMode
                      ? `${routePanelsCount} אזורים מוכנים לאיסוף. כל שורה מרכזת 1-3 משלוחים קרובים עם פעולה מהירה אחת.`
                      : 'סמן מה נאסף, לחץ אספתי, והמערכת תעביר מיד למסך ביצוע המשלוחים.'}
                  </div>
                </EntitySurface>

                <div className="grid gap-3">
                  {routeCards.map((group) => {
                    const isFocused = activeRouteGroup?.id === group.id;
                    const leadDelivery = group.leadDelivery;
                    const isExecutingRoute = false;
                    const pickupCheckedIds = new Set(pickupChecklistByRouteId[group.id] ?? []);
                    const completedIds = new Set(completedStopIdsByRouteId[group.id] ?? []);
                    const pickupReady =
                      group.items.length > 0 &&
                      group.items.every((item) => pickupCheckedIds.has(item.id));
                    const checkedPickupCount = pickupCheckedIds.size;
                    const routePendingCount = group.items.filter(
                      (item) => !completedIds.has(item.id)
                    ).length;
                    const selfAssignedToCurrentUser = Boolean(
                      currentUserId &&
                        group.items.length > 0 &&
                        group.items.every((item) => item.assignedUserId === currentUserId)
                    );
                    const routeWorkerName =
                      group.assignedWorkerName ??
                      (selfAssignedToCurrentUser ? currentUserName ?? null : null);

                    return (
                      <section
                        key={group.id}
                        className={cn(
                          'rounded-[30px] border border-surface-strong bg-surface-translucent-strong p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.35)] transition-all backdrop-blur-xl',
                          isFocused && 'ring-2 ring-brand-soft'
                        )}
                      >
                        <div className="space-y-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="inline-flex h-3 w-3 rounded-full"
                                  style={{ backgroundColor: group.color }}
                                />
                                <div className="text-base font-black text-fg">
                                  {group.cityLabels[0] ?? group.label}
                                </div>
                                <div className="rounded-full bg-surface-highlight px-2.5 py-1 text-[11px] font-black text-fg-muted">
                                  {group.items.length} משלוחים
                                </div>
                                {routeWorkerName ? (
                                  <div className="rounded-full bg-info-soft px-2.5 py-1 text-[11px] font-black text-brand-deep">
                                    {routeWorkerName}
                                  </div>
                                ) : null}
                                {selfAssignedToCurrentUser ? (
                                  <div className="rounded-full bg-info-soft px-2.5 py-1 text-[11px] font-black text-brand">
                                    המסלול שלי
                                  </div>
                                ) : null}
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <div className="rounded-[18px] bg-surface-muted px-3 py-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
                                    נשארו
                                  </div>
                                  <div className="mt-1 text-sm font-black text-fg">
                                    {routePendingCount}
                                  </div>
                                </div>
                                <div className="rounded-[18px] bg-surface-muted px-3 py-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
                                    משך
                                  </div>
                                  <div className="mt-1 text-sm font-black text-fg">
                                    {formatDurationLabel(group.summary?.routeDurationMinutes ?? null) ??
                                      'לא חושב'}
                                  </div>
                                </div>
                                <div className="rounded-[18px] bg-surface-muted px-3 py-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
                                    איסוף
                                  </div>
                                  <div className="mt-1 text-sm font-black text-fg">
                                    {checkedPickupCount}/{group.items.length}
                                  </div>
                                </div>
                              </div>
                              {leadDelivery ? (
                                <div className="mt-2 rounded-[18px] bg-info-soft px-3 py-2 text-xs font-semibold text-brand-deep">
                                  התחלה אצל {leadDelivery.customerName}
                                  {typeof group.summary?.routeDistanceKm === 'number'
                                    ? ` • ${formatDistanceLabel(group.summary.routeDistanceKm)}`
                                    : ''}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => onSelectRouteGroup(group.id)}
                                className="h-11 rounded-2xl border-subtle px-4 font-black text-fg"
                              >
                                {isFocused ? 'בפוקוס' : 'פוקוס למסלול'}
                              </Button>
                              <Button
                                type="button"
                                variant="default"
                                disabled={
                                  !pickupReady || assignPending || deliveryTaskPending
                                }
                                onClick={() => onTakeRoute(group.id)}
                                className={cn(
                                  'h-11 rounded-2xl bg-brand-solid px-5 font-black text-on-inverse hover:bg-brand-solid-hover',
                                  !pickupReady &&
                                    'cursor-not-allowed bg-neutral-mute text-fg-subtle hover:bg-neutral-mute'
                                )}
                              >
                                {isExecutingRoute ? 'חזור' : 'אספתי'}
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            {group.items.map((item) => {
                              const isChecked = pickupCheckedIds.has(item.id);

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => onTogglePickupItem(group.id, item.id)}
                                  className={cn(
                                    'rounded-[24px] border p-3 text-right transition-all',
                                    isChecked
                                      ? 'surface-select-success'
                                      : 'border-subtle bg-surface hover:border-brand-soft hover:bg-surface-muted'
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-black text-fg">
                                        {item.customerName}
                                      </div>
                                      <div className="mt-1 truncate rounded-[14px] bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-fg-muted">
                                        {item.addressLine}
                                      </div>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      readOnly
                                      className="focus-ring-success mt-0.5 h-4 w-4 rounded border-subtle text-success focus:ring-2"
                                    />
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    <span className="rounded-full bg-surface px-2 py-1 text-[11px] font-black text-fg-muted">
                                      {item.itemsCount ?? 1} פריטים
                                    </span>
                                    {typeof item.routeIndex === 'number' ? (
                                      <span className="rounded-full bg-info-soft px-2 py-1 text-[11px] font-black text-brand-deep">
                                        #{item.routeIndex}
                                      </span>
                                    ) : null}
                                    {item.estimatedArrivalAt ? (
                                      <span className="rounded-full bg-inverse-strip px-2 py-1 text-[11px] font-black text-on-dark">
                                        {item.estimatedArrivalAt}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-3 rounded-[16px] bg-info-soft px-2.5 py-2 text-xs font-semibold text-brand-deep">
                                    {item.itemsSummary ?? 'ללא פירוט נוסף'}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-surface-muted px-3 py-3">
                            <div className="text-xs font-semibold text-fg-muted">
                              נקודת יציאה: {originTimelineLabel}
                            </div>
                            {!pickupReady ? (
                              <div className="text-xs font-black text-warning">
                                סמן את כל המשלוחים לפני היציאה
                              </div>
                            ) : (
                              <div className="text-xs font-black text-success">
                                המסלול מוכן ליציאה
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>

                {activeRouteGroup ? (
                  <div className="rounded-[24px] border border-subtle bg-surface px-4 py-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-3.5 w-3.5 rounded-full"
                            style={{ backgroundColor: activeRouteGroup.color }}
                          />
                          <div className="text-sm font-black text-fg">
                            מסלול בפוקוס: {activeRouteGroup.label}
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-fg-muted">
                          <span>{activeRouteCountLabel}</span>
                          {activeRouteDurationLabel ? <span>{activeRouteDurationLabel}</span> : null}
                          {activeRouteDistanceLabel ? <span>{activeRouteDistanceLabel}</span> : null}
                        </div>
                        {activeRouteGroup.leadDelivery ? (
                          <div className="mt-2 text-xs font-bold text-brand">
                            התחלה אצל {activeRouteGroup.leadDelivery.customerName}
                            {activeRouteGroup.leadDelivery.addressLine
                              ? ` • ${activeRouteGroup.leadDelivery.addressLine}`
                              : ''}
                          </div>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={onClearRouteGroupFocus}
                        className="h-10 rounded-full border-subtle px-4 font-black text-fg"
                      >
                        הצג את כל המסלולים
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasDeferredRoute ? (
              <EntityNotice
                icon={AlertCircle}
                tone="warning"
                title="המערכת פיצלה אוטומטית את המסלול בגלל חריגה מתקרת יום העבודה"
                description={`לפני הפיצול: ${routePreSplitWorkloadLabel ?? 'לא חושב'} • היום: ${routeWorkloadLabel ?? 'לא חושב'} • מחר: ${deferredRouteWorkloadLabel ?? 'לא חושב'}`}
              >
                <div className="text-xs font-bold text-accent">
                  {routeSummaryDeferredStopCount} משלוחים רחוקים יותר הועברו אוטומטית ל-
                  {deferredDateLabel ?? 'מחר'} למסלול נפרד.
                </div>
              </EntityNotice>
            ) : null}

            {routeSummaryExceedsBusinessHours || routeSummaryExceedsOperationalLimit ? (
              <EntityNotice
                icon={AlertCircle}
                tone="warning"
                title="המסלול עדיין חורג מהמגבלות התפעוליות"
                description={`עומס יומי משוער: ${routeWorkloadLabel ?? 'לא חושב'} • קיבולת: ${routeOperationalLimitLabel ?? routeCapacityLabel ?? routeSummaryBusinessHoursLabel}`}
              >
                <div className="text-xs font-bold text-accent">
                  חריגה נוכחית: {routeSummaryOverflowLabel ?? 'לא חושב'}.
                </div>
              </EntityNotice>
            ) : null}

            {showRegionQueue ? (
              <DeliveryRegionQueue
                deliveries={allPickupDeliveries}
                selectedIds={freeSelectedIds}
                onToggle={onToggleFreeDelivery}
                onOpenDelivery={onSelectDelivery}
                isFreeRoutePending={isFreeRoutePending}
                onStartFreeRoute={onStartFreeRoute}
                primaryActionLabel={routePlanPrimaryLabel}
              />
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center text-fg-subtle">
            <Truck className="h-12 w-12 opacity-20" />
            <p className="text-sm font-bold">
              {emptyQueueLabel ?? `אין משלוחים מתוזמנים ל-${selectedRouteDateLabel}`}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
