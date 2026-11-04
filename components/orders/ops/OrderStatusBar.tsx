'use client';

import { StatusChangeDialog, type StatusChangeRequest } from '@/components/orders/modals/StatusChangeDialog';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/use-toast';
import { getStatusLabel } from '@/lib/orderStatus';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@prisma/client';
import { Check, PauseCircle, PlayCircle, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface StatusBarOrder {
  id: string;
  number?: string | null;
  status?: string | null;
  fulfillmentType?: string | null;
  statusHistory?: ReadonlyArray<{
    fromStatus?: string | null;
    toStatus?: string | null;
    createdAt?: string | Date | null;
  }> | null;
}

interface OrderStatusBarProps {
  order: StatusBarOrder;
  canOverride: boolean;
  onChangeStatus: (request: StatusChangeRequest) => Promise<unknown>;
  className?: string;
}

const PRIMARY_LABELS: Partial<Record<OrderStatus, string>> = {
  PROCESSING: 'התחל טיפול',
  READY: 'סמן כמוכן',
  IN_TRANSIT: 'יצא לדרך',
  INSTALLATION: 'התחל התקנה',
  COMPLETED: 'סמן כהושלם',
};

const STEP_BACK: Partial<Record<OrderStatus, OrderStatus>> = {
  PROCESSING: 'RECEIVED',
  READY: 'PROCESSING',
  IN_TRANSIT: 'READY',
  INSTALLATION: 'READY',
};

function getForwardTargets(status: OrderStatus, isInstallation: boolean): OrderStatus[] {
  switch (status) {
    case 'RECEIVED':
      return ['PROCESSING'];
    case 'PROCESSING':
      return ['READY'];
    case 'READY':
      return isInstallation ? ['INSTALLATION', 'IN_TRANSIT'] : ['IN_TRANSIT', 'INSTALLATION'];
    case 'IN_TRANSIT':
      return isInstallation ? ['INSTALLATION', 'COMPLETED'] : ['COMPLETED'];
    case 'INSTALLATION':
      return ['COMPLETED'];
    default:
      return [];
  }
}

function getHeldFrom(order: StatusBarOrder): OrderStatus | null {
  const holds = (order.statusHistory ?? [])
    .filter((entry) => entry.toStatus === 'ON_HOLD' && entry.fromStatus)
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  return (holds[0]?.fromStatus as OrderStatus | undefined) ?? null;
}

/**
 * The order's place in the MVP flow and the one action that moves it on. Every change goes
 * through a dialog that explains unmet conditions; the server enforces them.
 */
export function OrderStatusBar({ order, canOverride, onChangeStatus, className }: Readonly<OrderStatusBarProps>) {
  const { toast } = useToast();
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const status = String(order.status ?? 'RECEIVED') as OrderStatus;
  const isInstallation = order.fulfillmentType === 'INSTALLATION';
  const heldFrom = status === 'ON_HOLD' ? getHeldFrom(order) : null;
  const flowStatus = heldFrom ?? status;

  const steps = useMemo<OrderStatus[]>(() => {
    const delivery: OrderStatus =
      flowStatus === 'IN_TRANSIT' || (flowStatus !== 'INSTALLATION' && !isInstallation)
        ? 'IN_TRANSIT'
        : 'INSTALLATION';
    return ['RECEIVED', 'PROCESSING', 'READY', delivery, 'COMPLETED'];
  }, [flowStatus, isInstallation]);
  const currentIndex = steps.indexOf(flowStatus);

  const [primary, secondary] = getForwardTargets(status, isInstallation);
  const back = STEP_BACK[status];
  const isClosed = status === 'COMPLETED' || status === 'CANCELLED';

  const handleConfirm = async (request: StatusChangeRequest) => {
    await onChangeStatus(request);
    toast({ title: `ההזמנה עברה ל"${getStatusLabel(request.targetStatus)}"`, variant: 'default' });
  };

  return (
    <section
      className={cn('rounded-[20px] border border-subtle bg-surface p-3 shadow-sm sm:p-4', className)}
      aria-label="שלב ההזמנה"
      data-testid="order-status-bar"
      data-status={status}
    >
      <ol className="flex items-start gap-1" aria-label="מסלול ההזמנה">
        {steps.map((step, index) => {
          const done = status === 'COMPLETED' || index < currentIndex;
          const current = index === currentIndex && status !== 'COMPLETED';
          return (
            <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-1" aria-current={current ? 'step' : undefined}>
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-black',
                  done && 'border-transparent bg-[var(--color-success-600)] text-white',
                  current && 'border-transparent bg-[var(--color-primary-600)] text-white',
                  !done && !current && 'border-subtle bg-surface-muted text-fg-subtle'
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  'w-full truncate text-center text-[11px] leading-tight sm:text-xs',
                  current ? 'font-black text-fg' : 'font-medium text-fg-muted'
                )}
              >
                {getStatusLabel(step)}
              </span>
            </li>
          );
        })}
      </ol>

      {status === 'ON_HOLD' || status === 'CANCELLED' ? (
        <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm font-bold text-warning">
          {status === 'ON_HOLD'
            ? `ההזמנה מושהית${heldFrom ? ` בשלב "${getStatusLabel(heldFrom)}"` : ''}`
            : 'ההזמנה בוטלה'}
        </p>
      ) : null}

      {!isClosed ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-subtle pt-3">
          {status === 'ON_HOLD' && heldFrom ? (
            <Button size="sm" onClick={() => setTarget(heldFrom)} data-testid="status-action-resume">
              <PlayCircle className="h-4 w-4" aria-hidden />
              המשך טיפול
            </Button>
          ) : null}
          {primary ? (
            <Button size="sm" onClick={() => setTarget(primary)} data-testid={`status-action-${primary}`}>
              {PRIMARY_LABELS[primary]}
            </Button>
          ) : null}
          {secondary ? (
            <Button size="sm" variant="outline" onClick={() => setTarget(secondary)} data-testid={`status-action-${secondary}`}>
              {PRIMARY_LABELS[secondary]}
            </Button>
          ) : null}
          <div className="ms-auto flex gap-1">
            {back ? (
              <Button size="sm" variant="ghost" onClick={() => setTarget(back)} data-testid="status-action-back">
                <Undo2 className="h-4 w-4" aria-hidden />
                {`חזור ל"${getStatusLabel(back)}"`}
              </Button>
            ) : null}
            {status !== 'ON_HOLD' ? (
              <Button size="sm" variant="ghost" onClick={() => setTarget('ON_HOLD')} data-testid="status-action-ON_HOLD">
                <PauseCircle className="h-4 w-4" aria-hidden />
                השהה
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {target ? (
        <StatusChangeDialog
          isOpen
          onClose={() => setTarget(null)}
          currentStatus={status}
          targetStatus={target}
          order={order}
          canOverride={canOverride}
          onConfirm={handleConfirm}
        />
      ) : null}
    </section>
  );
}
