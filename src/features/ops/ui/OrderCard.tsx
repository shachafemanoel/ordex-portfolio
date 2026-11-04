'use client';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer';
import { useToast } from '@/components/ui/ToastProvider';
import apiClient from '@/lib/apiClient';
import {
  getDefaultAdvanceTarget,
  getStatusColor,
  getStatusLabel,
  isTerminal,
  ORDER_STATUS_TRANSITIONS,
} from '@/lib/orderStatus';
import { cn } from '@/lib/utils';
import type { OpsQueueItem } from '@/src/server/dto/ops.dto';
import { OrderStatus } from '@prisma/client';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { OrderCardDetails } from './order-card/OrderCardDetails';
import { OrderCardSummary, type OrderCardVariant } from './order-card/OrderCardSummary';
import {
  formatNextActionDetailed,
  formatNextActionTimeOnly,
  formatNextActionWeekdayShort,
  getOrderCardAppearance,
} from './order-card/orderCard.utils';

const LONG_PRESS_MS = 600;

interface OrderCardProps extends OpsQueueItem {
  onClick?: (id: string) => void;
  onRefresh?: () => void;
  /** `shipments` = address-first compact header (time + distance chips) */
  displayVariant?: OrderCardVariant;
}

/**
 * Interactive order card with expandable details.
 * Collapsed: customer + address + weekday chip (orders) or address + time (shipments).
 * Expanded: items, actions, full schedule + time, status advance controls.
 */
export function OrderCard({
  id,
  number,
  customerName,
  customerEmail,
  customerPhone,
  addressLine,
  distanceKm,
  nextActionAt,
  isUrgent,
  status,
  derivedTask,
  itemsSummary,
  itemsCount,
  itemLabels,
  onClick,
  onRefresh,
  displayVariant = 'orders',
}: OrderCardProps) {
  const [itemsOpen, setItemsOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isAdvancing, setIsAdvancing] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<OrderStatus | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const currentStatus = (status as OrderStatus) ?? OrderStatus.RECEIVED;
  const availableStatuses: OrderStatus[] = ORDER_STATUS_TRANSITIONS[currentStatus] ?? [];
  const defaultAdvanceTarget = getDefaultAdvanceTarget(currentStatus);
  const showQuickAdvance = Boolean(defaultAdvanceTarget) && !isTerminal(currentStatus);

  useEffect(() => {
    if (optimisticStatus != null && optimisticStatus === currentStatus) {
      setOptimisticStatus(null);
    }
  }, [currentStatus, optimisticStatus]);

  const displayStatusLabel =
    optimisticStatus != null ? getStatusLabel(optimisticStatus) : derivedTask.statusLabelHe;
  const displayStatusToneClass =
    optimisticStatus != null ? getStatusColor(optimisticStatus) : undefined;

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      router.prefetch(`/orders/${id}`);
    }, 300);
  };
  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const toggleItemsOpen = () => setItemsOpen((open) => !open);
  const safeItemLabels = Array.isArray(itemLabels)
    ? itemLabels.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];
  const itemCount =
    typeof itemsCount === 'number' && itemsCount > 0 ? itemsCount : safeItemLabels.length;
  const itemCountLabel = itemCount > 0 ? `${itemCount} פריטים` : 'ללא פריטים';
  const contactHref = customerPhone ? `tel:${customerPhone.replace(/\s+/g, '')}` : null;
  const nextActionDetailed = formatNextActionDetailed(nextActionAt);
  const compactDayLabel = formatNextActionWeekdayShort(nextActionAt);
  const timeChipLabel = formatNextActionTimeOnly(nextActionAt);

  const { isActionableNow, isPriorityOrder, statusToneClass, surfaceClass } =
    getOrderCardAppearance(derivedTask, isUrgent);

  const resolvedStatusToneClass = displayStatusToneClass ?? statusToneClass;
  const advanceButtonTargetLabel = defaultAdvanceTarget
    ? getStatusLabel(defaultAdvanceTarget)
    : derivedTask.primaryAction.labelHe;

  const advanceToStatus = useCallback(
    async (targetStatus?: OrderStatus) => {
      const resolvedTarget = targetStatus ?? getDefaultAdvanceTarget(currentStatus);
      if (!resolvedTarget) {
        toast.error('אין שלב הבא');
        return;
      }
      setOptimisticStatus(resolvedTarget);
      setIsAdvancing(true);
      try {
        const res = await apiClient(`/api/orders/${id}/advance-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetStatus: resolvedTarget }),
        });
        if (!res.ok) {
          setOptimisticStatus(null);
          const json = await res.json().catch(() => ({}));
          toast.error(json?.error?.message ?? 'לא ניתן לקדם שלב');
          return;
        }
        setFlashSuccess(true);
        setTimeout(() => setFlashSuccess(false), 600);
        toast.success('הסטטוס עודכן בהצלחה');
        onRefresh?.();
      } catch {
        setOptimisticStatus(null);
        toast.error('שגיאה בעדכון הסטטוס');
      } finally {
        setIsAdvancing(false);
      }
    },
    [currentStatus, id, onRefresh, toast]
  );

  const handleAdvanceClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    void advanceToStatus();
  };

  const startLongPress = useCallback(() => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setSheetOpen(true);
    }, LONG_PRESS_MS);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const statusOptionsList = availableStatuses.map((s) => ({
    status: s,
    label: getStatusLabel(s),
  }));

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={toggleItemsOpen}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleItemsOpen();
        }
      }}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl border px-3 py-3 text-right font-sans sm:px-3.5 sm:py-3.5',
        'shadow-sm transition-all hover:-translate-y-px hover:shadow-md',
        'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/35 focus:ring-offset-2',
        surfaceClass
      )}
      aria-expanded={itemsOpen}
    >
      <div
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onContextMenu={handleContextMenu}
      >
        <OrderCardSummary
          id={id}
          number={number}
          customerName={customerName}
          addressLine={addressLine}
          isPriorityOrder={isPriorityOrder}
          statusLabel={displayStatusLabel}
          statusToneClass={resolvedStatusToneClass}
          compactDayLabel={displayVariant === 'orders' ? compactDayLabel : null}
          variant={displayVariant}
          timeChipLabel={displayVariant === 'shipments' ? timeChipLabel : null}
          distanceKm={distanceKm}
        />

        {itemsOpen ? (
          <OrderCardDetails
            customerName={customerName}
            itemsSummary={itemsSummary}
            itemLabels={safeItemLabels}
            contactHref={contactHref}
            customerEmail={customerEmail ?? null}
            customerPhone={customerPhone ?? null}
            orderId={id}
            orderStatus={status}
            onOpenOrder={onClick}
            nextActionDetailedLabel={nextActionDetailed}
            primaryActionLabel={derivedTask.primaryAction.labelHe}
            itemCountLabel={itemCountLabel}
            isPriorityOrder={isPriorityOrder}
            showQuickAdvance={showQuickAdvance}
            isAdvancing={isAdvancing}
            flashSuccess={flashSuccess}
            advanceButtonTargetLabel={advanceButtonTargetLabel}
            onAdvanceClick={handleAdvanceClick}
          />
        ) : null}
      </div>

      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent side="bottom" className="max-h-[80vh] rounded-t-[24px] pb-8">
          <DrawerHeader className="pb-2 text-right">
            <DrawerTitle className="text-[16px]">שינוי סטטוס הזמנה</DrawerTitle>
            <p className="text-[13px] text-fg-muted">בחר סטטוס חדש עבור הזמנה {number}</p>
          </DrawerHeader>
          <div className="mt-2 flex flex-col gap-2 overflow-y-auto px-4">
            {statusOptionsList.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-fg-subtle">אין מעברים זמינים</p>
            ) : (
              statusOptionsList.map(({ status: st, label }) => (
                <button
                  key={st}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSheetOpen(false);
                    void advanceToStatus(st);
                  }}
                  className="flex w-full items-center justify-between rounded-[16px] border border-subtle-light bg-surface px-4 py-3 text-right text-[14px] font-semibold text-fg shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50 active:scale-[0.98]"
                >
                  <span>{label}</span>
                  {st === currentStatus && <Check className="h-4 w-4 text-primary-500" />}
                </button>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {contextMenu ? (
        <div
          className="fixed z-[9999] min-w-[180px] overflow-hidden rounded-[14px] border border-subtle bg-surface py-1 shadow-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="border-b border-subtle-light px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-fg-subtle">
            שנה סטטוס
          </p>
          {statusOptionsList.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-fg-subtle">אין מעברים זמינים</p>
          ) : (
            statusOptionsList.map(({ status: st, label }) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  void advanceToStatus(st);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-right text-[13px] font-medium text-fg-muted hover:bg-primary-50 hover:text-brand"
              >
                <span>{label}</span>
                {st === currentStatus && <Check className="h-3.5 w-3.5 text-primary-500" />}
              </button>
            ))
          )}
        </div>
      ) : null}
    </article>
  );
}
