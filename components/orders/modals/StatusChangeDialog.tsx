'use client';

import { EntityNotice } from '@/components/shared/display/EntityPrimitives';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/orders/shared/OrderStatusBadge';
import { getStatusLabel } from '@/lib/orderStatus';
import { executeGuards } from '@/lib/status-guards';
import type { OrderStatus } from '@prisma/client';
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const REASON_REQUIRED: ReadonlySet<string> = new Set(['ON_HOLD', 'CANCELLED']);

export interface StatusChangeRequest {
  targetStatus: OrderStatus;
  reason: string;
  override: boolean;
}

interface StatusChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: OrderStatus;
  targetStatus: OrderStatus;
  /** The order as the client sees it; used to explain unmet conditions before submitting. */
  order: { id: string; number?: string | null };
  /** Only the business admin may override unmet conditions. */
  canOverride?: boolean;
  onConfirm: (request: StatusChangeRequest) => Promise<void>;
}

export function StatusChangeDialog({
  isOpen,
  onClose,
  currentStatus,
  targetStatus,
  order,
  canOverride = false,
  onConfirm,
}: StatusChangeDialogProps) {
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setOverride(false);
    setServerError(null);
  }, [isOpen, targetStatus]);

  const targetLabel = getStatusLabel(targetStatus);

  // The server decides; this only explains up front what is still missing.
  const unmet = useMemo(
    () =>
      executeGuards(order, targetStatus, { currentStatus }).blockingFailures.filter(
        (failure) => failure.id !== 'reason_required'
      ),
    [order, targetStatus, currentStatus]
  );

  const isBlocked = unmet.length > 0 && !override;
  const reasonRequired = REASON_REQUIRED.has(targetStatus) || override;
  const reasonMissing = reasonRequired && reason.trim().length < 2;

  const handleConfirm = async () => {
    setLoading(true);
    setServerError(null);
    try {
      await onConfirm({ targetStatus, reason: reason.trim(), override });
      onClose();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'שגיאה בעדכון סטטוס');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`מעבר ל"${targetLabel}"`} maxWidth="md">
      <div className="space-y-4" dir="rtl" data-testid="status-change-dialog">
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={currentStatus} />
          <span className="text-xl font-bold leading-none text-fg-subtle" aria-hidden>
            ←
          </span>
          <OrderStatusBadge status={targetStatus} />
          <span className="ms-auto text-sm text-fg-muted">
            הזמנה <span className="font-bold text-fg">#{order.number ?? order.id.slice(-6)}</span>
          </span>
        </div>

        {unmet.length > 0 ? (
          <div className="space-y-2" data-testid="status-change-unmet">
            <p className="text-sm font-bold text-fg">{`חסר כדי לעבור ל"${targetLabel}":`}</p>
            <ul className="space-y-1.5">
              {unmet.map((failure) => (
                <li
                  key={failure.id}
                  className="flex items-center gap-2.5 rounded-lg border border-[#ffd9bf] bg-[#fff1e6] px-3 py-2 text-sm text-[#b34f00]"
                >
                  <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 font-medium">{failure.message}</span>
                </li>
              ))}
            </ul>
            {canOverride ? (
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-subtle bg-surface-muted px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(event) => setOverride(event.target.checked)}
                  className="h-4 w-4"
                  data-testid="status-change-override"
                />
                <ShieldAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                <span className="font-medium">עקוף את התנאים (מנהל בלבד, נרשם בהיסטוריה)</span>
              </label>
            ) : null}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            כל התנאים למעבר מתקיימים
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="status-change-reason" className="text-xs font-bold text-fg-muted">
            {override ? 'סיבת העקיפה' : 'סיבה'}{' '}
            <span className="font-normal text-fg-subtle">{reasonRequired ? '(חובה)' : '(רשות)'}</span>
          </label>
          <textarea
            id="status-change-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="h-20 w-full resize-none rounded-lg border border-subtle bg-surface-muted p-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-blue-500/30"
            placeholder={reasonRequired ? 'למה ההזמנה עוברת לשלב הזה?' : 'הערה להיסטוריה'}
            disabled={loading}
          />
        </div>

        {serverError ? (
          <EntityNotice icon={XCircle} tone="warning" title="המעבר לא בוצע" description={serverError} />
        ) : null}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            סגור
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || isBlocked || reasonMissing}
            loading={loading}
            data-testid="status-change-confirm"
          >
            {override ? `עקוף ועבור ל"${targetLabel}"` : `עבור ל"${targetLabel}"`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
