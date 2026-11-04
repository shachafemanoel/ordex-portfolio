import { useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useCallback } from 'react';

export type DeliveryHubTabId = 'trip' | 'active' | 'future';

const HUB_PATH = '/dashboard/operations';

function normalizeHubTab(raw: string | null): DeliveryHubTabId {
  if (raw === 'trip' || raw === 'future') {
    return raw;
  }

  return 'active';
}

export function useDeliveryHubTabRouting() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hubTab = normalizeHubTab(searchParams.get('hub'));
  const screenMode: 'active-route' | 'overview' = hubTab === 'trip' ? 'active-route' : 'overview';

  const setHubTab = useCallback(
    (next: DeliveryHubTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('hub', next);

      if (next !== 'trip') {
        params.delete('exec');
      }

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${HUB_PATH}?${query}` : HUB_PATH, { scroll: false });
      });
    },
    [router, searchParams]
  );

  return { hubTab, screenMode, setHubTab };
}
