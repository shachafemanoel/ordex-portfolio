'use client';

import { Button } from '@/components/ui/Button';
import apiClient from '@/lib/apiClient';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function WebPushOptIn() {
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sw = 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(sw);
    if (!sw) return;

    void (async () => {
      try {
        const res = await apiClient('/api/push/vapid-public');
        setReady(res.ok);
        if (!res.ok) {
          setMessage('התראות דחיפה לא הוגדרו בשרת (מפתחות VAPID).');
        }
      } catch {
        setReady(false);
        setMessage('לא ניתן לבדוק זמינות התראות.');
      }
    })();
  }, []);

  const refreshSubscriptionState = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    } catch {
      setSubscribed(false);
    }
  }, [supported]);

  useEffect(() => {
    void refreshSubscriptionState();
  }, [refreshSubscriptionState]);

  const subscribe = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiClient('/api/push/vapid-public');
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.data?.publicKey) {
        setMessage('השרת לא חושף מפתח ציבורי — הגדירו VAPID ב-.env');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw-push.js');
      await reg.update();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(j.data.publicKey),
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setMessage('מנוי דחיפה לא תקין');
        return;
      }

      const save = await apiClient('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });
      if (!save.ok) {
        const err = await save.json().catch(() => ({}));
        setMessage(err?.error?.message || 'שמירת המנוי נכשלה');
        return;
      }
      setSubscribed(true);
      setMessage('התראות דחיפה הופעלו לדפדפן זה.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const json = sub.toJSON();
        await apiClient('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMessage('בוטל המנוי בדפדפן זה.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <p className="text-sm text-slate-500">
        הדפדפן לא תומך בהתראות דחיפה (Web Push).
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">התראות דחיפה (תפעול)</h2>
      <p className="mt-1 text-sm text-slate-600">
        קבלו התראה כשנוצרת הזמנה חדשה — ללא צורך לפתוח את האפליקציה.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!subscribed ? (
          <Button
            type="button"
            disabled={busy || !ready}
            onClick={() => void subscribe()}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            הפעלת התראות
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void unsubscribe()}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
            ביטול התראות
          </Button>
        )}
      </div>
      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
