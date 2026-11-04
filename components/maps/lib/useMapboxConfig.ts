'use client';

import { useQuery } from '@tanstack/react-query';
import type { MapboxConfigState } from './types';

const FALLBACK_STYLE_ID = 'mapbox/streets-v12';

type MapboxConfigResponse = {
  data?: {
    token?: string;
    styleId?: string;
  };
};

export function useMapboxConfig(): MapboxConfigState {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mapbox-config'],
    queryFn: async () => {
      const response = await fetch('/api/mapbox/config', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Mapbox is not configured');
      }
      return (await response.json()) as MapboxConfigResponse;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const accessToken = data?.data?.token ?? '';
  const styleId = data?.data?.styleId ?? FALLBACK_STYLE_ID;

  return {
    accessToken,
    styleId,
    isLoading,
    isError,
    hasMapboxConfig: Boolean(accessToken),
  };
}
