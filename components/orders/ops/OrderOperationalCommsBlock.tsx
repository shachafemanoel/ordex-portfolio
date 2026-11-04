'use client';

import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastProvider';
import { OrderQuickOperationalEmailPresets } from '@/components/orders/ops/OrderQuickOperationalEmailPresets';
import apiClient from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type GoogleStatus = {
  connected: boolean;
  oauthConfigured?: boolean;
  connectedEmail?: string;
  status?: string;
  lastTokenError?: string | null;
};

type InstallationEvent = {
  id: string;
  googleSyncStatus: string;
  googleHtmlLink: string | null;
  googleLastError: string | null;
  startTime: string;
  endTime: string;
} | null;

export function OrderOperationalCommsBlock({
  orderId,
  defaultToEmail,
  scheduledAtIso,
  scheduledEndIso,
}: Readonly<{
  orderId: string;
  defaultToEmail: string;
  scheduledAtIso: string | null;
  scheduledEndIso: string | null;
}>) {
  const { success, error } = useToast();
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [installation, setInstallation] = useState<InstallationEvent>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [to, setTo] = useState(defaultToEmail);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, cRes] = await Promise.all([
        apiClient('/api/integrations/google/status'),
        apiClient(`/api/orders/${orderId}/operational-comms`),
      ]);
      if (gRes.ok) {
        const j = await gRes.json();
        setGoogle(j.data as GoogleStatus);
      }
      if (cRes.ok) {
        const j = await cRes.json();
        setInstallation(j.data?.installationCalendarEvent ?? null);
      }
    } catch {
      error('טעינת נתוני תקשורת נכשלה');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setTo(defaultToEmail);
  }, [defaultToEmail]);

  const googleReady =
    Boolean(google?.connected) && String(google?.status) === 'ACTIVE';

  const syncStatus = installation?.googleSyncStatus ?? 'NOT_LINKED';

  const sendEmail = async () => {
    const trimmed = body.trim();
    if (!trimmed) {
      error('נא למלא תוכן הודעה');
      return;
    }
    const idem =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setSending(true);
    try {
      const res = await apiClient(`/api/orders/${orderId}/operational-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idem,
        },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim() || undefined,
          body: trimmed,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          j?.error?.message || (typeof j?.detail === 'string' ? j.detail : 'שליחה נכשלה');
        throw new Error(msg);
      }
      success('המייל נשלח');
      setModalOpen(false);
      setBody('');
      void load();
    } catch (e) {
      error(e instanceof Error ? e.message : 'שגיאת שליחה');
    } finally {
      setSending(false);
    }
  };

  const retryCalendar = async () => {
    if (!scheduledAtIso) {
      error('אין מועד התקנה שמור — עדכן תיאום תחילה');
      return;
    }
    const start = scheduledAtIso;
    const end =
      scheduledEndIso ||
      new Date(new Date(scheduledAtIso).getTime() + 60 * 60 * 1000).toISOString();

    setRetrying(true);
    try {
      const res = await apiClient(`/api/orders/${orderId}/google-calendar/installation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: start, endTime: end }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = j?.error?.message || 'סנכרון יומן נכשל';
        throw new Error(msg);
      }
      success('היומן עודכן');
      void load();
    } catch (e) {
      error(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className={cn(
        'mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-slate-800">תקשורת תפעולית</span>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden />
        ) : (
          <EntityBadge label={syncStatus} tone="neutral" className="text-[10px]" />
        )}
      </div>

      {installation?.googleHtmlLink ? (
        <a
          href={installation.googleHtmlLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          פתח ביומן Google
        </a>
      ) : null}

      {syncStatus === 'ERROR' && installation?.googleLastError ? (
        <p className="text-xs text-red-700" dir="auto">
          {installation.googleLastError}
        </p>
      ) : null}

      {!googleReady && !loading ? (
        <p className="text-xs text-slate-600">
          חיבור Google Workspace פעיל נדרש לשליחת אימייל וסנכרון יומן התקנה.
        </p>
      ) : null}

      <OrderQuickOperationalEmailPresets orderId={orderId} onSent={() => void load()} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!googleReady || sending}
          title={!googleReady ? 'חיבור Google נדרש' : undefined}
          onClick={() => setModalOpen(true)}
        >
          שליחת אימייל
        </Button>
        {syncStatus === 'ERROR' && scheduledAtIso ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={retrying}
            onClick={() => void retryCalendar()}
          >
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="me-1 h-4 w-4" />
                נסה שוב — יומן
              </>
            )}
          </Button>
        ) : null}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="שליחת אימייל מהזמנה"
        className="max-w-lg"
      >
        <div className="space-y-4 p-6">
          <FormField label="אל">
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              dir="ltr"
              className="text-left"
            />
          </FormField>
          <FormField label="נושא (אופציונלי)">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} dir="auto" />
          </FormField>
          <FormField label="תוכן">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[140px] w-full rounded-lg border border-slate-200 p-2 text-sm"
              dir="auto"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              ביטול
            </Button>
            <Button type="button" disabled={sending} onClick={() => void sendEmail()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שלח'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
