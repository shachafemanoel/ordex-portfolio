'use client';

import { useAuth } from '@/components/AuthProvider';
import { AuthLoadingScreen } from '@/components/layout/AuthLoadingScreen';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

type Props = {
  allowedRoles: readonly string[];
  /** Where to send users who are signed in but lack a permitted role */
  fallbackHref?: string;
  children: React.ReactNode;
};

/**
 * Client-side role enforcement when the server had no session cookie but the client
 * recovered auth via Bearer token (same cases as ClientAuthGate).
 */
export function RequireRoleGate({
  allowedRoles,
  fallbackHref = '/forbidden',
  children,
}: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const kicked = useRef(false);
  const roleKey = typeof user?.role === 'string' ? user.role : user?.role?.key;
  const allowed = Boolean(roleKey && allowedRoles.includes(roleKey));

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      if (kicked.current) {
        return;
      }
      kicked.current = true;
      const returnTo = pathname && pathname !== '/login' ? pathname : '/';
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (allowed) {
      return;
    }
    if (kicked.current) {
      return;
    }
    kicked.current = true;
    router.replace(fallbackHref);
  }, [loading, user, allowed, fallbackHref, router, pathname]);

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user || !allowed) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
