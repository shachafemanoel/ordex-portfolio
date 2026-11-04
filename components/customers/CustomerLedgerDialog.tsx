'use client';

import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import apiClient from '@/lib/apiClient';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrencyCents, formatDate, formatDateTime } from '@/lib/utils';
import type {
  CustomerAccountSummary,
  CustomerLedgerEntryView,
  OutstandingOrderSummary,
} from '@/lib/types';
import { useEffect, useState } from 'react';

type LedgerEntry = CustomerLedgerEntryView;
type OutstandingOrder = OutstandingOrderSummary;
type AccountSummary = CustomerAccountSummary;

interface CustomerLedgerPayload {
  name: string;
  accountSummary?: AccountSummary;
  ledgerEntries?: LedgerEntry[];
  outstandingOrders?: OutstandingOrder[];
}

interface CustomerLedgerDialogProps {
  customerId: string;
  customerName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerLedgerDialog({
  customerId,
  customerName,
  isOpen,
  onClose,
}: CustomerLedgerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CustomerLedgerPayload | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isOpen || !customerId) return;

    const controller = new AbortController();
    const fetchLedger = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient(`/api/customers/${customerId}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error?.message || 'שגיאה בטעינת כרטסת');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    };

    fetchLedger();

    return () => controller.abort();
  }, [customerId, isOpen, reloadKey]);

  const account = data?.accountSummary;
  const ledgerEntries = data?.ledgerEntries ?? [];
  const outstandingOrders = data?.outstandingOrders ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`כרטסת לקוח · ${customerName ?? data?.name ?? DISPLAY_TEXT.unknownCustomer}`}
      maxWidth="4xl"
    >
      {loading ? (
        <div className="py-10 text-center text-gray-600">טוען כרטסת...</div>
      ) : error ? (
        <div className="space-y-4 text-center">
          <p className="text-red-600">{error}</p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            נסו שוב
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-500">יתרה נוכחית</div>
              <div
                className={`text-2xl font-semibold ${
                  (account?.currentBalanceCents ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {formatCurrencyCents(account?.currentBalanceCents ?? 0)}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-500">קרדיט זמין</div>
              <div className="text-2xl font-semibold text-gray-900">
                {formatCurrencyCents(account?.availableCreditCents)}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-500">תנאי תשלום</div>
              <div className="text-2xl font-semibold text-gray-900">
                {account?.paymentTermsDays != null ? `NET ${account.paymentTermsDays}` : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-500">תשלום אחרון</div>
              <div className="text-sm font-semibold text-gray-900">
                {formatDate(account?.lastPaymentAt)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">
                  הזמנות פתוחות ({outstandingOrders.length})
                </h4>
                {account?.overdueOrdersCount ? (
                  <span className="text-sm text-red-600 font-semibold">
                    {account.overdueOrdersCount} באיחור
                  </span>
                ) : null}
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {outstandingOrders.length === 0 && (
                  <p className="text-sm text-gray-500">אין יתרות פתוחות ללקוח זה.</p>
                )}
                {outstandingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold">#{order.number}</div>
                      <div className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-semibold ${
                          order.balanceCents > 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {formatCurrencyCents(order.balanceCents)}
                      </div>
                      <div className="text-xs text-gray-500">
                        יעד: {formatDate(order.dueDate)}
                      </div>
                    </div>
                    <StatusBadge status={order.status} size="sm" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">תנועות אחרונות</h4>
                <span className="text-sm text-gray-500">
                  {Math.min(ledgerEntries.length, 6)} תנועות אחרונות
                </span>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {ledgerEntries.slice(0, 6).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {entry.description || (entry.type === 'PAYMENT' ? 'תשלום' : 'חיוב')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDateTime(entry.createdAt)}
                        {entry.order?.number && ` · הזמנה #${entry.order.number}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-semibold ${
                          entry.deltaCents < 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {entry.deltaCents < 0 ? '-' : '+'}
                        {formatCurrencyCents(Math.abs(entry.deltaCents))}
                      </div>
                      <div className="text-xs text-gray-500">
                        יתרה: {formatCurrencyCents(entry.balanceCents)}
                      </div>
                    </div>
                  </div>
                ))}
                {ledgerEntries.length === 0 && (
                  <p className="text-sm text-gray-500">אין תנועות פיננסיות להצגה.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
