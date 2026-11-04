'use client';

import { useAuth } from '@/components/AuthProvider';
import { AuthLoadingScreen } from '@/components/layout/AuthLoadingScreen';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/card';
import { enterBusiness } from '@/lib/tenancy/client';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';


const sellingPoints = [
  'מעקב מלא אחר ההזמנות והספקים שלך בזמן אמת',
  'התראות חכמות ופעולות מהירות מכל מקום במערכת',
  'ניתוח ביצועים ומדדים שמאפשרים החלטות מבוססות נתונים',
];

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function LoginMarketingPanel() {
  return (
    <section className="space-y-6">
      <div className="flex justify-start">
        <BrandLogo height={48} className="max-w-full" />
      </div>
      <div className="space-y-3">
        <h1 className="text-4xl font-bold leading-tight text-fg sm:text-5xl">
          כל הזמנה. מהתחלה עד הסוף.
        </h1>
        <p className="max-w-2xl text-lg text-fg-muted">
          ניהול לקוחות, הזמנות ותפעול במקום אחד. התחבר כדי להמשיך לאזור הניהול.
        </p>
      </div>
      <ul className="space-y-3 text-sm text-fg-muted">
        {sellingPoints.map((point) => (
          <li key={point} className="flex items-start gap-3">
            <span className="tone-accent mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full">
              ✓
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <Card className="p-4 text-sm text-fg-muted shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3">
          <div className="surface-subtle relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <BrandLogo variant="symbol" height={18} alt="" />
          </div>
          <p className="leading-relaxed">
            צוות רצף מחויב לספק עבורך כלי עבודה יציבים, נגישים ומדויקים לניהול ההזמנות
            והספקים שלך.
          </p>
        </div>
      </Card>
    </section>
  );
}

interface LoginFormCardProps {
  email: string;
  password: string;
  rememberMe: boolean;
  error: string | null;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (checked: boolean) => void;
  onSubmit: (event: React.FormEvent) => Promise<void>;
}

function LoginFormCard({
  email,
  password,
  rememberMe,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onRememberMeChange,
  onSubmit,
}: LoginFormCardProps) {
  return (
    <Card className="w-full rounded-2xl p-8 shadow-[var(--shadow-lg)]">
      <div className="mb-6 space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-fg">התחברות מאובטחת</h2>
        <p className="text-sm text-fg-muted">
          הזן את פרטי ההתחברות שסופקו עבורך והמשך לניהול המערכת.
        </p>
      </div>
      {error ? (
        <div className="surface-danger-soft mb-4 rounded-xl px-4 py-3 text-sm shadow-[var(--shadow-sm)]">
          {error}
        </div>
      ) : null}
      <form className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-fg" htmlFor="email">
            דוא״ל
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-fg" htmlFor="password">
            סיסמה
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="flex items-center justify-between text-sm text-fg-muted">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => onRememberMeChange(event.target.checked)}
              className="focus-ring h-4 w-4 rounded border-subtle bg-surface text-brand focus:ring-2 focus:ring-[var(--color-focus)]"
            />
            <span>השאר אותי מחובר</span>
          </label>
          <span className="text-xs opacity-70">גישה מאושרת למנהלים בלבד</span>
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'מתחבר…' : 'התחבר למערכת'}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-fg-muted">
        הכניסה מיועדת למשתמשים שקיבלו הזמנה לעסק. לשחזור גישה יש לפנות למפעיל המערכת.
      </p>
    </Card>
  );
}

export function LoginPageContainer(props: Props) {
  const searchParams = use(props.searchParams);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const returnToRaw = typeof searchParams?.returnTo === 'string' ? searchParams.returnTo : '/orders';
  const returnTo = /^\/(?![\/\\])/.test(returnToRaw) && !returnToRaw.includes('\\') && returnToRaw !== '/' ? returnToRaw : '/orders';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      const destination =
        returnTo.startsWith('/login') || returnTo === '/' ? '/orders' : returnTo;
      router.replace(destination);
    }
  }, [authLoading, returnTo, router, user]);

  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    return null;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success === false) {
        let errorMessage = data?.message || `Login failed (${res.status})`;

        if (data?.error === 'VALIDATION_ERROR' || data?.error === 'validation_error') {
          if (Array.isArray(data?.detail)) {
            errorMessage = data.detail.map((issue: { message: string }) => issue.message).join(', ');
          } else if (typeof data?.detail === 'string') {
            errorMessage = data.detail;
          } else if (data?.detail) {
            errorMessage = JSON.stringify(data.detail);
          }
        } else if (data?.detail) {
          errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        } else if (data?.error?.message) {
          errorMessage = data.error.message;
        }

        setError(errorMessage);
        return;
      }


      const destination =
        returnTo && returnTo !== '/' && !returnTo.startsWith('/login') ? returnTo : '/orders';
      if (data?.data?.token) enterBusiness(data.data.token, destination);
      else setError('לא התקבל סשן תקף. יש לנסות להיכנס שוב');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-muted text-fg">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-20%] h-[580px] w-[580px] rounded-full bg-gradient-to-br from-[var(--color-primary-200)]/60 via-[var(--color-primary-100)]/40 to-transparent blur-3xl" />
        <div className="absolute -right-10 bottom-[-10%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-[var(--color-accent-500)]/20 via-[var(--color-primary-200)]/20 to-transparent blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-bg-primary)_0%,transparent_55%)] opacity-90" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
        <div className="grid w-full max-w-6xl gap-12 rounded-3xl border border-subtle bg-surface-translucent-strong p-10 shadow-[var(--shadow-xl)] lg:grid-cols-[1.1fr_0.9fr] lg:p-14">
          <LoginMarketingPanel />
          <section className="flex items-center">
            <LoginFormCard
              email={email}
              password={password}
              rememberMe={rememberMe}
              error={error}
              loading={loading}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onRememberMeChange={setRememberMe}
              onSubmit={onSubmit}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
