'use client';

import { FinanceDashboard } from '@/components/finance/FinanceDashboard';
import { AuthLoadingScreen } from '@/components/layout/AuthLoadingScreen';
import apiClient from '@/lib/apiClient';
import { useEffect, useState } from 'react';

/**
 * Loads finance dashboard data only after the client session is available (Bearer / cookie),
 * so the server RSC does not run Prisma-heavy work for unauthenticated requests.
 */
export function DeferredFinanceDashboard() {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiClient('/api/dashboard/finance', {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.success) {
          const message =
            payload?.error?.message || payload?.message || `טעינה נכשלה (${res.status})`;
          if (!cancelled) setError(message);
          return;
        }
        if (!cancelled) setData(payload.data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'שגיאת רשת');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (error) {
    return <FinanceDashboard data={null} error={error} />;
  }

  return <FinanceDashboard data={data} />;
}
