'use client';

import { getAuthToken } from '@/lib/auth/tokenStorage';
import { Button } from '@/components/ui/Button';
import { useCallback, useEffect, useState } from 'react';

type Member = {
  id: string;
  role: string;
  isActive: boolean;
  user: { name: string | null; email: string };
};
type Invitation = {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export function BusinessMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  async function request(path: string, method = 'GET', data?: unknown) {
    const response = await fetch(`/api/tenants/${path}`, {
      method,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken() || ''}`,
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const result = await response.json();
    if (!response.ok || !result.success)
      throw new Error(
        typeof result.detail === 'string' ? result.detail : result.error?.message || 'הפעולה נכשלה'
      );
    return result.data;
  }
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [people, invites] = await Promise.all([request('members'), request('invitations')]);
      setMembers(people);
      setInvitations(invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'טעינת הצוות נכשלה');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function revoke(path: string, id: string) {
    setBusy(true);
    setError('');
    try {
      await request(path, 'DELETE', { id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'הביטול נכשל');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">צוות העסק</h1>
        <p className="mt-2 text-fg-muted">
          גישה ניתנת בהזמנה בלבד. מנהל עסק יכול להזמין ולבטל גישה לעסק הפעיל.
        </p>
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-red-300 p-4 text-red-700">
          {error}{' '}
          <button className="underline" onClick={load}>
            ניסיון חוזר
          </button>
        </div>
      )}
      <form
        className="grid gap-4 rounded-2xl border border-subtle bg-surface p-5 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setError('');
          setLink('');
          setCopied(false);
          try {
            const invite = await request('invitations', 'POST', {
              email: form.get('email'),
              role: form.get('role'),
            });
            setLink(`${window.location.origin}/invite#${invite.token}`);
            await load();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'יצירת ההזמנה נכשלה');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="grid gap-2">
          דוא״ל
          <input
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            maxLength={320}
            className="rounded-xl border border-subtle p-3"
          />
        </label>
        <label className="grid gap-2">
          תפקיד
          <select name="role" className="rounded-xl border border-subtle bg-surface p-3">
            <option value="OPERATIONS">עובד תפעול</option>
            <option value="ADMIN">מנהל עסק</option>
          </select>
        </label>
        <Button
          type="submit"
          disabled={busy || loading}
          className="rounded-xl bg-[var(--color-primary-600)] p-3 font-bold text-white disabled:opacity-50"
        >
          {busy ? 'מעדכנים…' : 'יצירת הזמנה'}
        </Button>
      </form>
      {link && (
        <div className="space-y-3 rounded-2xl border border-subtle bg-surface p-5" role="status">
          <p>הקישור יוצג כעת בלבד. יש להעבירו לנמען באופן פרטי; תוקפו 48 שעות.</p>
          <input
            aria-label="קישור ההזמנה"
            readOnly
            value={link}
            dir="ltr"
            className="w-full rounded-lg border border-subtle p-2"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            className="underline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setError('ההעתקה נכשלה. אפשר לסמן ולהעתיק את הקישור ידנית');
              }
            }}
          >
            {copied ? 'הקישור הועתק' : 'העתקת קישור'}
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">טוענים צוות והזמנות…</p>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="text-lg font-bold">חברי העסק</h2>
            {!members.length && <p>עדיין אין חברים בעסק.</p>}
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-subtle bg-surface p-4"
              >
                <div>
                  <p className="font-bold">{member.user.name || member.user.email}</p>
                  <p className="break-all text-sm text-fg-muted">
                    {member.user.email} · {member.role === 'ADMIN' ? 'מנהל עסק' : 'עובד תפעול'} ·{' '}
                    {member.isActive ? 'פעיל' : 'הגישה בוטלה'}
                  </p>
                </div>
                {member.isActive && (
                  <button
                    disabled={busy}
                    className="underline"
                    onClick={() => revoke('members', member.id)}
                  >
                    ביטול גישה
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-bold">הזמנות הצטרפות</h2>
            {!invitations.length && <p>לא נשלחו הזמנות.</p>}
            {invitations.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-subtle bg-surface p-4"
              >
                <div>
                  <p className="break-all">{invite.email}</p>
                  <p className="text-sm text-fg-muted">
                    {invite.acceptedAt
                      ? 'מומשה'
                      : invite.revokedAt
                        ? 'בוטלה'
                        : new Date(invite.expiresAt) <= new Date()
                          ? 'פגה'
                          : `בתוקף עד ${new Date(invite.expiresAt).toLocaleString('he-IL')}`}
                  </p>
                </div>
                {!invite.acceptedAt && !invite.revokedAt && (
                  <button
                    disabled={busy}
                    className="underline"
                    onClick={() => revoke('invitations', invite.id)}
                  >
                    ביטול הזמנה
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <p className="text-sm text-fg-muted">
        שכחת סיסמה? יש לפנות למפעיל המערכת לצורך אימות זהות ושחזור החשבון. מנהל עסק אינו יכול להחליף
        סיסמה של חשבון גלובלי.
      </p>
    </section>
  );
}
