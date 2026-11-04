'use client';

import { Button } from '@/components/ui/Button';
import { useRBAC } from '@/hooks/useRBAC';
import apiClient from '@/lib/apiClient';
import type { previewImport } from '@/lib/integrations/woocommerce/import';
import type { listJobs } from '@/lib/integrations/woocommerce/operations';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

type Jobs = Awaited<ReturnType<typeof listJobs>>;
type Preview = Awaited<ReturnType<typeof previewImport>>;
const endpoint = '/api/integrations/woocommerce';
const states: Record<string, string> = {
  PENDING: 'ממתינה',
  RUNNING: 'בעיבוד',
  SUCCEEDED: 'הושלמה',
  FAILED: 'כשל סופי',
  NEEDS_ATTENTION: 'דורשת טיפול',
  IMPORTING: 'ייבוא בתהליך',
  PARTIAL_FAILURE: 'ייבוא עם כשלים',
};
const kinds: Record<string, string> = {
  ORDER_EVENT: 'עדכון הזמנה',
  ORDER_IMPORT: 'ייבוא הזמנה',
  PRODUCT_IMPORT: 'ייבוא מוצר',
  IMPORT_PAGE: 'עמוד ייבוא',
  IMPORT: 'ייבוא ראשוני',
  PREVIEW: 'תצוגה מקדימה',
};
async function unwrap<T>(
  request: Promise<{ success: boolean; data?: T; error?: { message?: string } }>
): Promise<T> {
  const result = await request;
  if (!result.success) throw new Error(result.error?.message ?? 'הפעולה נכשלה');
  return result.data as T;
}

export function WooSyncOperations() {
  const { isAdmin } = useRBAC();
  const client = useQueryClient();
  const [resource, setResource] = useState<'products' | 'orders'>('products');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [importId, setImportId] = useState<string | null>(null);
  const jobs = useQuery({
    queryKey: ['woo-jobs', page],
    enabled: isAdmin,
    queryFn: () => unwrap(apiClient.get<Jobs>(`${endpoint}/jobs?page=${page}`)),
    refetchInterval: 5000,
    retry: false,
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['woo-jobs'] });
  };
  const showError = (e: unknown) => setError(e instanceof Error ? e.message : 'הפעולה נכשלה');
  const loadPreview = useMutation({
    mutationFn: (targetPage: number) =>
      unwrap(apiClient.post<Preview>(`${endpoint}/preview`, { resource, page: targetPage })),
    onSuccess: (data) => {
      setPreview(data);
      setConfirm(false);
      setError('');
    },
    onError: showError,
  });
  const start = useMutation({
    mutationFn: () =>
      unwrap(
        apiClient.post<{ jobId: string }>(`${endpoint}/import`, {
          previewId: preview?.previewId,
          confirm: true,
        })
      ),
    onSuccess: (data) => {
      setImportId(data.jobId);
      setConfirm(false);
      setError('');
      refresh();
    },
    onError: showError,
  });
  const retry = useMutation({
    mutationFn: (id: string) => unwrap(apiClient.post(`${endpoint}/jobs/${id}/retry`, {})),
    onSuccess: () => {
      setError('');
      refresh();
    },
    onError: showError,
  });
  if (!isAdmin) return null;
  const data = jobs.data;
  const failed =
    (data?.counts.FAILED ?? 0) +
    (data?.counts.NEEDS_ATTENTION ?? 0) +
    (data?.counts.PARTIAL_FAILURE ?? 0);
  return (
    <section
      className="mt-6 space-y-4 rounded-xl border border-subtle bg-surface p-4 text-fg"
      aria-labelledby="woo-sync-title"
      data-testid="woo-sync"
    >
      <h2 id="woo-sync-title" className="text-lg font-bold">
        ייבוא ומעקב סנכרון
      </h2>
      <p className="text-sm text-fg-muted">
        הייבוא כולל קטלוג והזמנות פתוחות בלבד. פרטי המסחר והתשלום מתעדכנים מהחנות; שיבוץ והערות
        נשמרים ברצף.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          תצוגה מקדימה
          <select
            aria-label="סוג תצוגה מקדימה"
            className="ms-2 rounded border border-subtle bg-surface p-2"
            value={resource}
            onChange={(e) => {
              setResource(e.target.value as 'products' | 'orders');
              setPreview(null);
              setConfirm(false);
            }}
          >
            <option value="products">קטלוג</option>
            <option value="orders">הזמנות</option>
          </select>
        </label>
        <Button
          disabled={loadPreview.isPending}
          onClick={() => loadPreview.mutate(1)}
          data-testid="woo-preview"
        >
          טעינת תצוגה מקדימה
        </Button>
      </div>
      {preview && (
        <div className="space-y-3" data-testid="woo-preview-results">
          <p className="text-sm">
            עמוד {preview.page} · {preview.items.length} רשומות. סטטוס לא מוכר דורש בדיקה ואינו נכלל
            אוטומטית בייבוא.
          </p>
          {!preview.items.length ? (
            <p>אין רשומות בעמוד זה</p>
          ) : (
            <ul className="max-h-60 space-y-2 overflow-auto rounded border border-subtle p-3">
              {preview.items.map((item) => (
                <li key={item.id} className="text-sm">
                  {item.label}
                  {item.sku ? ` · ${item.sku}` : ''}
                  {item.status ? ` · ${item.status}` : ''}
                  {item.review ? ' · דורשת בדיקה' : !item.eligible ? ' · לא תיובא (סגורה)' : ''}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={preview.page === 1 || loadPreview.isPending}
              onClick={() => loadPreview.mutate(preview.page - 1)}
            >
              הקודם
            </Button>
            <Button
              variant="outline"
              disabled={!preview.hasNext || loadPreview.isPending}
              onClick={() => loadPreview.mutate(preview.page + 1)}
            >
              הבא
            </Button>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            אני מאשר ייבוא של הקטלוג ושל ההזמנות הפתוחות (ממתינה לתשלום, בהמתנה, בטיפול), ללא
            היסטוריה סגורה
          </label>
          <Button
            disabled={!confirm || start.isPending}
            onClick={() => start.mutate()}
            data-testid="woo-import"
          >
            אישור והתחלת ייבוא
          </Button>
        </div>
      )}
      {importId && (
        <p role="status">
          הייבוא נוסף לתור. מזהה עבודה:{' '}
          <span dir="ltr" className="break-all">
            {importId}
          </span>
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {jobs.isPending ? (
        <p role="status">טוען עבודות…</p>
      ) : jobs.isError ? (
        <div role="alert">
          <p>טעינת העבודות נכשלה</p>
          <Button variant="outline" onClick={() => jobs.refetch()}>
            נסה שוב
          </Button>
        </div>
      ) : (
        data && (
          <>
            {(failed > 0 || data.waitingTooLong || data.workerStale) && (
              <div
                role="alert"
                className="space-y-1 rounded border border-subtle bg-surface-muted p-3 text-sm"
                data-testid="woo-alerts"
              >
                {failed > 0 && <p>יש {failed} עבודות עם כשל או צורך בטיפול</p>}
                {data.waitingTooLong && <p>יש עבודה שממתינה יותר מחמש דקות</p>}
                {data.workerStale && <p>לא התקבל עדכון פעילות Worker בשתי הדקות האחרונות</p>}
              </div>
            )}
            <p className="text-sm text-fg-muted">
              ממתינות: {data.counts.PENDING ?? 0} · הצלחות: {data.counts.SUCCEEDED ?? 0} · פעילות
              Worker:{' '}
              {data.workerLastSeenAt
                ? new Date(data.workerLastSeenAt).toLocaleString('he-IL')
                : 'טרם התקבלה'}
            </p>
            {!data.jobs.length ? (
              <p>אין עבודות סנכרון עדיין</p>
            ) : (
              <ul className="space-y-2" data-testid="woo-jobs">
                {data.jobs.map((job) => (
                  <li key={job.id} className="space-y-1 rounded border border-subtle p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>
                        {kinds[job.kind] ?? job.kind}
                        {job.objectId ? ` #${job.objectId}` : ''} · {states[job.state] ?? job.state}
                      </span>
                      <span>{job.attempts}/5 ניסיונות</span>
                    </div>
                    {job.lastErrorCode && (
                      <p className="break-all text-danger">
                        סיבת הכשל: <span dir="ltr">{job.lastErrorCode}</span>
                      </p>
                    )}
                    {job.kind === 'IMPORT' && job.progress && (
                      <p>
                        הסתיימו: {Number((job.progress as { succeeded?: number }).succeeded ?? 0)} ·
                        נכשלו: {Number((job.progress as { failed?: number }).failed ?? 0)}
                      </p>
                    )}
                    {['FAILED', 'NEEDS_ATTENTION'].includes(job.state) && job.attempts < 5 && (
                      <Button
                        variant="outline"
                        disabled={retry.isPending}
                        onClick={() => retry.mutate(job.id)}
                      >
                        ניסיון חוזר
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                עבודות קודמות
              </Button>
              <Button
                variant="outline"
                disabled={!data.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                עבודות נוספות
              </Button>
            </div>
          </>
        )
      )}
    </section>
  );
}
