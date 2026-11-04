'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, PlugZap, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useToast } from '@/components/ui/ToastProvider';
import { useRBAC } from '@/hooks/useRBAC';
import apiClient from '@/lib/apiClient';
import type { WooConnectionView } from '@/lib/integrations/woocommerce/connection';

const QUERY_KEY = ['integrations', 'woocommerce'];

const STATUS_DISPLAY: Record<WooConnectionView['status'], { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  CONNECTED: { label: 'מחוברת', variant: 'success' },
  ERROR: { label: 'דורשת טיפול', variant: 'destructive' },
  DISABLED: { label: 'מנותקת', variant: 'secondary' },
  NOT_CONNECTED: { label: 'לא מחוברת', variant: 'secondary' },
};

const formatTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : 'עדיין לא התקבלו';

async function unwrap<T>(request: Promise<{ success: boolean; data?: T; error?: { message?: string } }>, fallback: string): Promise<T> {
  const response = await request;
  if (!response.success) throw new Error(response.error?.message || fallback);
  return response.data as T;
}

export function WooCommerceConnectionCard() {
  const { isAdmin } = useRBAC();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ storeUrl: '', consumerKey: '', consumerSecret: '' });
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connection = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => unwrap(apiClient.get<WooConnectionView>('/api/integrations/woocommerce'), 'טעינת החיבור נכשלה'),
    enabled: isAdmin,
    retry: false,
  });

  const onError = (title: string) => (error: unknown) => toast.error(title, error instanceof Error ? error.message : undefined);

  const test = useMutation({
    mutationFn: () => unwrap(apiClient.post('/api/integrations/woocommerce/test', form.consumerKey ? form : {}), 'הבדיקה נכשלה'),
    onSuccess: () => {
      toast.success('החיבור תקין', form.consumerKey ? 'אפשר לחבר את החנות' : 'החנות שולחת הזמנות לרצף');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => {
      onError('החיבור לא עבר')(error);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const connect = useMutation({
    mutationFn: () => unwrap(apiClient.post<WooConnectionView>('/api/integrations/woocommerce', form), 'החיבור נכשל'),
    onSuccess: (view) => {
      queryClient.setQueryData(QUERY_KEY, view);
      setForm({ storeUrl: '', consumerKey: '', consumerSecret: '' });
      toast.success('החנות חוברה', 'הזמנות חדשות יגיעו לרצף מעכשיו');
    },
    onError: onError('לא ניתן לחבר את החנות'),
  });

  const disconnect = useMutation({
    mutationFn: () => unwrap(apiClient.delete<WooConnectionView>('/api/integrations/woocommerce'), 'הניתוק נכשל'),
    onSuccess: (view) => {
      queryClient.setQueryData(QUERY_KEY, view);
      setConfirmDisconnect(false);
      toast.success('החיבור לחנות נותק');
    },
    onError: onError('לא ניתן לנתק את החנות'),
  });

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-sm font-medium text-fg-muted">רק מנהל העסק יכול לנהל את החיבור לחנות.</CardContent>
      </Card>
    );
  }

  const view = connection.data;
  const isLive = view?.status === 'CONNECTED' || view?.status === 'ERROR';
  const busy = test.isPending || connect.isPending || disconnect.isPending;
  const formReady = form.storeUrl.trim() && form.consumerKey.trim() && form.consumerSecret.trim();
  const status = STATUS_DISPLAY[view?.status ?? 'NOT_CONNECTED'];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (formReady) connect.mutate();
  };

  return (
    <Card data-testid="woo-connection">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5 text-brand" aria-hidden />
            חנות WooCommerce
          </CardTitle>
          {view ? <Badge variant={status.variant} data-testid="woo-status">{status.label}</Badge> : null}
        </div>
        <CardDescription>הזמנות חדשות מהחנות נכנסות לרצף אוטומטית, עם הלקוח, הפריטים ומצב התשלום כפי שהם בחנות.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {connection.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> טוען את מצב החיבור…
          </div>
        ) : connection.isError ? (
          <p className="text-sm font-medium text-danger">{(connection.error as Error).message}</p>
        ) : isLive && view ? (
          <dl className="grid gap-3 rounded-xl border border-subtle bg-surface-muted p-4 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold text-fg-subtle">כתובת החנות</dt>
              <dd className="truncate font-medium text-fg" dir="ltr">{view.storeUrl}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-subtle">מפתח</dt>
              <dd className="font-medium text-fg" dir="ltr">{view.consumerKey}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-subtle">התראות פעילות בחנות</dt>
              <dd className="font-medium text-fg">{view.webhookCount} מתוך 2</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-subtle">אירוע אחרון מהחנות</dt>
              <dd className="font-medium text-fg" data-testid="woo-last-event">{formatTime(view.lastEventAt)}</dd>
            </div>
            {view.lastError ? (
              <p className="text-sm font-medium text-danger sm:col-span-2" role="alert">{view.lastError}</p>
            ) : null}
          </dl>
        ) : null}

        <form id="woo-connect-form" className="grid gap-4" onSubmit={submit} autoComplete="off">
          <p className="text-sm font-semibold text-fg">{isLive ? 'חיבור מחדש עם מפתחות חדשים' : 'פרטי החנות'}</p>
          <div className="grid gap-1.5">
            <Label htmlFor="woo-store-url">כתובת החנות</Label>
            <Input id="woo-store-url" dir="ltr" inputMode="url" placeholder="https://shop.example.co.il" value={form.storeUrl} onChange={(event) => setForm({ ...form, storeUrl: event.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="woo-consumer-key">Consumer Key</Label>
              <Input id="woo-consumer-key" dir="ltr" placeholder="ck_…" value={form.consumerKey} onChange={(event) => setForm({ ...form, consumerKey: event.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="woo-consumer-secret">Consumer Secret</Label>
              <Input id="woo-consumer-secret" type="password" dir="ltr" placeholder="cs_…" value={form.consumerSecret} onChange={(event) => setForm({ ...form, consumerSecret: event.target.value })} />
            </div>
          </div>
          <p className="flex items-start gap-2 text-xs text-fg-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            יוצרים מפתח ב-WooCommerce › הגדרות › מתקדם › REST API, עם הרשאת Read/Write. הכתיבה נדרשת כדי שרצף ייצור בחנות את ההתראות על הזמנות. המפתחות נשמרים מוצפנים ולא מוצגים שוב.
          </p>
        </form>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button type="submit" form="woo-connect-form" disabled={!formReady || busy} loading={connect.isPending} data-testid="woo-connect">
          {isLive ? 'חבר מחדש' : 'חבר חנות'}
        </Button>
        <Button type="button" variant="outline" disabled={busy || (!formReady && !isLive)} loading={test.isPending} onClick={() => test.mutate()} data-testid="woo-test">
          בדיקת חיבור
        </Button>
        {isLive ? (
          confirmDisconnect ? (
            <span className="ms-auto flex flex-wrap items-center gap-2">
              <span className="text-sm text-fg-muted">ההתראות יימחקו מהחנות. לנתק?</span>
              <Button type="button" variant="destructive" size="sm" loading={disconnect.isPending} onClick={() => disconnect.mutate()} data-testid="woo-disconnect-confirm">
                נתק
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDisconnect(false)}>
                ביטול
              </Button>
            </span>
          ) : (
            <Button type="button" variant="ghost" className="ms-auto" disabled={busy} onClick={() => setConfirmDisconnect(true)} data-testid="woo-disconnect">
              נתק חנות
            </Button>
          )
        ) : null}
      </CardFooter>
    </Card>
  );
}
