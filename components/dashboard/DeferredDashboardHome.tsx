'use client';

import { DashboardOverviewScreen } from '@/components/dashboard/overview/DashboardOverviewScreen';
import { AuthLoadingScreen } from '@/components/layout/AuthLoadingScreen';
import { dashboardHomeJsonToScreenProps } from '@/lib/dashboard/dashboard-home-screen-mapper';
import type { DashboardHomeViewModelJson } from '@/lib/server/dashboard-home-view-model';
import apiClient from '@/lib/apiClient';
import { useEffect, useState } from 'react';

async function fetchDashboardHomeModel(signal: AbortSignal): Promise<DashboardHomeViewModelJson> {
  const res = await apiClient('/api/dashboard/home', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  const payload = await res.json().catch(() => null);

  if (!res.ok || !payload?.success) {
    const message = payload?.error?.message || payload?.message || `טעינה נכשלה (${res.status})`;
    throw new Error(message);
  }

  return payload.data as DashboardHomeViewModelJson;
}

/**
 * Fetches the dashboard home payload only after the client can authenticate the request,
 * avoiding heavy server RSC work when there is no session cookie on the initial render.
 */
export function DeferredDashboardHome() {
  const [model, setModel] = useState<DashboardHomeViewModelJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetchDashboardHomeModel(controller.signal)
      .then((nextModel) => {
        setModel(nextModel);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(e instanceof Error ? e.message : 'שגיאת רשת');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (error || !model) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center" dir="rtl">
        <p className="text-sm font-medium text-fg">לא ניתן לטעון את לוח הבקרה</p>
        <p className="mt-2 text-xs text-fg-muted">{error || 'אין נתונים'}</p>
      </div>
    );
  }

  const props = dashboardHomeJsonToScreenProps(model);

  return (
    <div className="min-h-full bg-transparent font-sans">
      <DashboardOverviewScreen {...props} />
    </div>
  );
}
