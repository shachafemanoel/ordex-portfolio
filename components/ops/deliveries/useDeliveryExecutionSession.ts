'use client';

import {
  deliveryRouteSessionResponseSchema,
  type DeliveryRouteSessionData,
  type DeliveryRouteSessionLocation,
  type StartDeliveryRouteSessionInput,
  type UpdateDeliveryRouteSessionInput,
} from '@/lib/delivery-route-session';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

const activeDeliverySessionQueryKey = ['delivery-route-session', 'active'] as const;

type DeliveryRouteSessionResponse = {
  success?: boolean;
  data?: DeliveryRouteSessionData | null;
};

async function requestSession<TBody = undefined>(
  method: 'GET' | 'POST' | 'PATCH',
  body?: TBody
): Promise<DeliveryRouteSessionResponse> {
  const response = await fetch('/api/deliveries/session', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload?.error?.message || payload?.message || 'Failed to update delivery execution session'
    );
  }

  return deliveryRouteSessionResponseSchema.parse(payload);
}

export function useDeliveryExecutionSession(enabled: boolean) {
  const queryClient = useQueryClient();
  const [liveLocation, setLiveLocation] = useState<DeliveryRouteSessionLocation | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<
    'idle' | 'watching' | 'denied' | 'unsupported'
  >('idle');
  const persistInFlightRef = useRef(false);
  const lastPersistedAtRef = useRef(0);
  const updateSessionMutationRef = useRef<
    (input: UpdateDeliveryRouteSessionInput) => Promise<DeliveryRouteSessionResponse>
  >(async () => ({ success: true, data: null }));

  const sessionQuery = useQuery({
    queryKey: activeDeliverySessionQueryKey,
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => requestSession('GET'),
  });

  const session = sessionQuery.data?.data ?? null;
  const sessionId = session?.id ?? null;
  const sessionStatus = session?.status ?? null;

  useEffect(() => {
    setLiveLocation(session?.lastKnownLocation ?? null);
  }, [session?.id, session?.lastKnownLocation]);

  const startSessionMutation = useMutation({
    mutationFn: async (input: StartDeliveryRouteSessionInput) => requestSession('POST', input),
    onSuccess: (payload) => {
      queryClient.setQueryData(activeDeliverySessionQueryKey, payload);
    },
  });

  const sessionActionMutation = useMutation({
    mutationFn: async (input: UpdateDeliveryRouteSessionInput) => requestSession('PATCH', input),
    onSuccess: (payload) => {
      const nextSession =
        payload.data && payload.data.status === 'ACTIVE'
          ? payload
          : ({ success: true, data: null } satisfies DeliveryRouteSessionResponse);
      queryClient.setQueryData(activeDeliverySessionQueryKey, nextSession);
    },
  });

  useEffect(() => {
    updateSessionMutationRef.current = sessionActionMutation.mutateAsync;
  }, [sessionActionMutation.mutateAsync]);

  useEffect(() => {
    if (!enabled || !sessionId || sessionStatus !== 'ACTIVE') {
      setTrackingStatus('idle');
      return;
    }

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setTrackingStatus('unsupported');
      return;
    }

    setTrackingStatus('watching');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation: DeliveryRouteSessionLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters:
            typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null,
          recordedAt: new Date(position.timestamp).toISOString(),
        };

        setLiveLocation(nextLocation);

        const now = Date.now();
        if (persistInFlightRef.current || now - lastPersistedAtRef.current < 15_000) {
          return;
        }

        persistInFlightRef.current = true;
        lastPersistedAtRef.current = now;

        updateSessionMutationRef
          .current({
            actionType: 'UPDATE_LOCATION',
            location: nextLocation,
          })
          .catch(() => undefined)
          .finally(() => {
            persistInFlightRef.current = false;
          });
      },
      () => {
        setTrackingStatus('denied');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15_000,
        timeout: 20_000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, sessionId, sessionStatus]);

  return {
    session,
    liveLocation,
    trackingStatus,
    isLoading: sessionQuery.isLoading,
    isFetching: sessionQuery.isFetching,
    startSession: startSessionMutation.mutateAsync,
    updateSession: sessionActionMutation.mutateAsync,
    isStartingSession: startSessionMutation.isPending,
    isUpdatingSession: sessionActionMutation.isPending,
    refetchSession: sessionQuery.refetch,
  };
}
