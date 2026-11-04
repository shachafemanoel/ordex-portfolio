'use client';

import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { getEntityToneDotClass, mapTaskColorToEntityTone } from '@/components/shared/display/displayStatus';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { useOrderQuickActions } from '@/hooks/useOrderQuickActions';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { deriveOrderTask } from '@/src/server/services/ops-triggers.service';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BulkActionsBar } from './BulkActionsBar';

export interface OrdersTableProps {
  orders: any[];
}

/* ─── Inline quick-action cell for table rows ─── */
const INTENT_CLASSES: Record<string, string> = {
  primary: 'bg-primary hover:bg-primary/90 text-white border-transparent',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-on-dark border-transparent',
  warning: 'bg-amber-500 hover:bg-amber-600 text-on-dark border-transparent',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white border-transparent',
  neutral: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200',
};

function TableQuickActionCell({ orderId, status }: { orderId: string; status: string }) {
  const { primaryAction, execute, isPending } = useOrderQuickActions(orderId, status);
  const { locale } = useUITranslation();

  if (!primaryAction) return <TableCell className="rounded-none bg-transparent">—</TableCell>;

  const label = locale === 'en' ? primaryAction.labelEn : primaryAction.label;
  const Icon = primaryAction.icon;

  if (primaryAction.href) {
    return (
      <TableCell className="rounded-none bg-transparent" onClick={(e) => e.stopPropagation()}>
        <Link
          href={primaryAction.href}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
            INTENT_CLASSES[primaryAction.intent]
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Link>
      </TableCell>
    );
  }

  return (
    <TableCell className="rounded-none bg-transparent" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={isPending || primaryAction.disabled}
        onClick={async (e) => {
          e.stopPropagation();
          await execute(primaryAction);
        }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60',
          INTENT_CLASSES[primaryAction.intent]
        )}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
        {label}
      </button>
    </TableCell>
  );
}

/* ─── Mobile card fallback for each order row ─── */
function MobileOrderRow({ order, onClick }: { order: any; onClick: () => void }) {
  const { t } = useUITranslation();
  const taskInfo = deriveOrderTask(order);
  const taskTone = mapTaskColorToEntityTone(taskInfo.taskColor);
  const customerName = order.customer?.name || order.customerName || t('orders.customerFallback');
  const { primaryAction, execute, isPending } = useOrderQuickActions(order.id, order.status);
  const { locale } = useUITranslation();

  return (
    <div
      className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 active:bg-slate-50 cursor-pointer"
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 shrink-0">
        {customerName.charAt(0)}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold text-sm text-slate-900 truncate">{customerName}</span>
          <span className="font-mono text-[11px] text-slate-400 shrink-0">#{order.number}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <EntityBadge
            label={taskInfo.taskTitleHe}
            tone={taskTone}
            dotClassName={getEntityToneDotClass(taskTone)}
            className="px-1.5 py-px tracking-tight"
          />
          <span className="text-[11px] text-slate-400">{formatDate(order.createdAt)}</span>
        </div>
      </div>

      {/* Quick action or amount */}
      <div className="shrink-0 flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs font-semibold text-slate-800">
          {formatCurrency(order.total || (order.totalCents ? order.totalCents / 100 : 0))}
        </span>
        {primaryAction?.href ? (
          <Link
            href={primaryAction.href}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors',
              INTENT_CLASSES[primaryAction.intent]
            )}
          >
            {locale === 'en' ? primaryAction.labelEn : primaryAction.label}
          </Link>
        ) : null}
        {primaryAction && !primaryAction.href && (
          <button
            type="button"
            disabled={isPending || primaryAction.disabled}
            onClick={async (e) => {
              e.stopPropagation();
              await execute(primaryAction);
            }}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-60',
              INTENT_CLASSES[primaryAction.intent]
            )}
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {locale === 'en' ? primaryAction.labelEn : primaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export function OrdersTable({ orders }: OrdersTableProps) {
  const router = useRouter();
  const { t } = useUITranslation();
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const toggleSelection = (orderId: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
    }
    setSelectedOrderIds(next);
  };

  const clearSelection = () => setSelectedOrderIds(new Set());

  const isAllSelected = orders.length > 0 && selectedOrderIds.size === orders.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      clearSelection();
    } else {
      setSelectedOrderIds(new Set(orders.map((o) => o.id)));
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-[#1a202c] rounded-xl shadow-sm border border-[#e5e7eb] dark:border-[#2d3748] overflow-hidden">
        {/* Mobile list view (hidden on md+) */}
        <div className="md:hidden divide-y divide-slate-50">
          {orders.map((order) => (
            <MobileOrderRow
              key={order.id}
              order={order}
              onClick={() => router.push(`/orders/${order.id}`)}
            />
          ))}
        </div>

        {/* Desktop table (hidden below md) */}
        <div className="hidden md:block">
          <Table className="border-collapse border-spacing-0">
            <TableHeader className="bg-gray-50 dark:bg-[#232a3b] border-b border-[#e5e7eb] dark:border-[#2d3748]">
              <TableRow className="bg-transparent shadow-none hover:translate-y-0">
                <TableHead className="w-[40px] text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </TableHead>
                <TableHead className="text-right">{t('orders.orderNumber')}</TableHead>
                <TableHead className="text-right">{t('orders.customer')}</TableHead>
                {/* Date hidden on md, shown on lg */}
                <TableHead className="text-right hidden lg:table-cell">
                  {t('orders.date')}
                </TableHead>
                {/* Labels hidden on md, shown on xl */}
                <TableHead className="text-right hidden xl:table-cell">
                  {t('orders.labels')}
                </TableHead>
                <TableHead className="text-right">{t('orders.task')}</TableHead>
                <TableHead className="text-left">{t('orders.total')}</TableHead>
                {/* Quick action column */}
                <TableHead className="text-left">{t('orders.quickAction')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {orders.map((order) => {
                const customerName =
                  order.customer?.name || order.customerName || t('orders.customerFallback');
                const taskInfo = deriveOrderTask(order);
                const taskTone = mapTaskColorToEntityTone(taskInfo.taskColor);
                const isSelected = selectedOrderIds.has(order.id);

                return (
                  <TableRow
                    key={order.id}
                    className={cn(
                      'group hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors cursor-pointer border-0 shadow-none hover:translate-y-0',
                      isSelected && 'bg-primary/10 hover:bg-primary/20'
                    )}
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    <TableCell
                      className="text-center rounded-none bg-transparent"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(order.id)}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </TableCell>
                    <TableCell className="font-bold text-primary-500 rounded-none bg-transparent">
                      #{order.number}
                    </TableCell>
                    <TableCell className="rounded-none bg-transparent">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300">
                          {customerName.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {customerName}
                        </span>
                      </div>
                    </TableCell>
                    {/* Date — hidden on md */}
                    <TableCell className="text-slate-500 dark:text-slate-400 rounded-none bg-transparent hidden lg:table-cell">
                      {formatDate(order.createdAt)}
                    </TableCell>
                    {/* Labels — hidden on md/lg */}
                    <TableCell className="rounded-none bg-transparent hidden xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {order.labels?.map((l: any) => (
                          <span
                            key={l.id}
                            className={cn(
                              'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter',
                              l.color || 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="rounded-none bg-transparent">
                      <EntityBadge
                        label={taskInfo.taskTitleHe}
                        tone={taskTone}
                        dotClassName={getEntityToneDotClass(taskTone)}
                        className="px-2.5 py-0.5 text-xs tracking-tight"
                      />
                    </TableCell>
                    <TableCell className="rounded-none bg-transparent text-left font-semibold">
                      {formatCurrency(
                        order.total || (order.totalCents ? order.totalCents / 100 : 0)
                      )}
                    </TableCell>
                    {/* Quick action */}
                    <TableQuickActionCell orderId={order.id} status={order.status} />
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <BulkActionsBar selectedCount={selectedOrderIds.size} onClear={clearSelection} />
    </>
  );
}
