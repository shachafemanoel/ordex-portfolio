'use client';

import { enterBusiness } from '@/lib/tenancy/client';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { useEffect, useState } from 'react';

export default function InvitePage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setToken(window.location.hash.slice(1));
    window.history.replaceState(null, '', '/invite');
  }, []);
  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-12 text-fg"
    >
      <Link href="/login" className="text-3xl font-bold text-brand">
        <BrandLogo height={32} />
      </Link>
      <div>
        <h1 className="text-2xl font-bold">הצטרפות לעסק</h1>
        <p className="mt-3 text-fg-muted">
          הקישור אישי, חד־פעמי ותקף ל־48 שעות. בחשבון קיים יש להזין את הסיסמה הנוכחית; בחשבון חדש יש
          לבחור סיסמה בת 12 תווים לפחות.
        </p>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          setBusy(true);
          const form = new FormData(event.currentTarget);
          try {
            const response = await fetch('/api/invitations/accept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token,
                name: form.get('name'),
                password: form.get('password'),
              }),
            });
            const result = await response.json();
            if (!response.ok || !result.success)
              throw new Error(
                (typeof result.detail === 'string' ? result.detail : result.error?.message) ||
                  'לא ניתן להשלים את ההצטרפות'
              );
            enterBusiness(result.data.token);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'החיבור נכשל. אפשר לנסות שוב');
            setBusy(false);
          }
        }}
      >
        <label className="grid gap-2">
          שם מלא
          <input
            name="name"
            autoComplete="name"
            required
            maxLength={120}
            className="rounded-xl border border-subtle bg-surface p-3"
          />
        </label>
        <label className="grid gap-2">
          סיסמה
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            className="rounded-xl border border-subtle bg-surface p-3"
          />
        </label>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {!token && <p role="status">יש לפתוח את קישור ההזמנה המלא שקיבלת ממנהל העסק.</p>}
        <Button
          type="submit"
          disabled={busy || !token}
          className="rounded-xl bg-[var(--color-primary-600)] p-3 font-bold text-white disabled:opacity-50"
        >
          {busy ? 'מצטרפים…' : 'הצטרפות לעסק'}
        </Button>
      </form>
      <Link className="underline" href="/login">
        כבר הצטרפת? כניסה לחשבון
      </Link>
    </main>
  );
}
