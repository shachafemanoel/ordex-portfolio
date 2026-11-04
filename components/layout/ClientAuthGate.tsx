'use client';

import { useAuth } from '@/components/AuthProvider';
import { AuthLoadingScreen } from '@/components/layout/AuthLoadingScreen';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

type Props = {
  serverAuthenticated: boolean;
  children: React.ReactNode;
};

/**
 * When the session cookie is missing (e.g. blocked, host mismatch) but a valid JWT exists
 * in localStorage, server layouts must not redirect to /login before the client can call
 * /api/auth/me. This gate waits for client auth, then allows the shell or sends to login.
 */
export function ClientAuthGate({ serverAuthenticated, children }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const didKick = useRef(false);

  const allowApp = serverAuthenticated || Boolean(user);

  useEffect(() => {
    if (serverAuthenticated) {
      return;
    }
    if (loading) {
      return;
    }
    if (user) {
      return;
    }
    if (didKick.current) {
      return;
    }
    didKick.current = true;
    const returnTo = pathname && pathname !== '/login' ? pathname : '/';
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [serverAuthenticated, loading, user, router, pathname]);

  if (!allowApp) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
