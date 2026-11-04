'use client';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import apiClient from '@/lib/apiClient';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type GoogleStatus = {
  connected: boolean;
  oauthConfigured?: boolean;
  connectedEmail?: string;
  status?: string;
  scopes?: string[];
  lastTokenError?: string | null;
  connectedAt?: string;
};

export function GoogleWorkspaceIntegrationCard() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient('/api/integrations/google/status');
      const j = await res.json();
      if (res.ok && j.data) setStatus(j.data as GoogleStatus);
      else setStatus({ connected: false, oauthConfigured: false });
    } catch {
      setStatus({ connected: false, oauthConfigured: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startConnect = () => {
    window.location.assign('/api/integrations/google/authorize');
  };

  const disconnect = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiClient('/api/integrations/google/disconnect', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error?.message || 'ניתוק נכשל');
      }
      setMsg({ tone: 'ok', text: 'החיבור נותק' });
      await load();
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'שגיאה' });
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiClient('/api/integrations/google/test', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error?.message || 'בדיקה נכשלה');
      }
      setMsg({ tone: 'ok', text: 'בדיקה הושלמה בהצלחה' });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'שגיאה' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          טוען סטטוס Google…
        </CardContent>
      </Card>
    );
  }

  const configured = status?.oauthConfigured !== false;
  const active = Boolean(status?.connected) && String(status?.status) === 'ACTIVE';

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="text-lg font-semibold">Google Workspace</div>
        <p className="text-sm text-slate-600">
          חיבור תיבת דואר לארגון לשליחת אימיילים תפעוליים וסנכרון אירועי התקנה ביומן (Gmail +
          Calendar).
        </p>

        {!configured ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            הגדר במערכת את <code className="rounded bg-white/80 px-1">GOOGLE_CLIENT_ID</code>,{' '}
            <code className="rounded bg-white/80 px-1">GOOGLE_CLIENT_SECRET</code> ו־
            <code className="rounded bg-white/80 px-1">GOOGLE_OAUTH_REDIRECT_URI</code> (ראה
            .env.example).
          </div>
        ) : null}

        {msg ? (
          <div
            className={
              msg.tone === 'ok'
                ? 'rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-900'
                : 'rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-900'
            }
          >
            {msg.text}
          </div>
        ) : null}

        {status?.connected ? (
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium text-slate-700">סטטוס: </span>
              {String(status.status)}
            </div>
            {status.connectedEmail ? (
              <div dir="ltr" className="text-slate-800">
                <span className="font-medium text-slate-700">תיבה: </span>
                {status.connectedEmail}
              </div>
            ) : null}
            {status.lastTokenError ? (
              <div className="text-xs text-red-700" dir="auto">
                {status.lastTokenError}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-slate-600">אין חיבור פעיל.</div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={startConnect} disabled={!configured || busy}>
            {active ? 'חבר מחדש' : 'חבר Google'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void disconnect()}
            disabled={!active || busy}
          >
            נתק
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void runTest()}
            disabled={!active || busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'בדיקה'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
