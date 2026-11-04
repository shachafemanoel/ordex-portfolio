/**
 * Custom hooks for the deliveries operations page.
 * Uses SWR for fetching and mutations for actions.
 */
'use client';

import { useCallback, useState } from 'react';
import useSWR, { mutate } from 'swr';

// ────────────────────────── Types ──────────────────────────

export interface DeliveryOrder {
  id: string;
  number: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  city: string | null;
  address: string | null;
  itemsSummary: string;
  itemsCount: number;
  scheduledAt: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  priority: string | null;
  totalCents: number;
  updatedAt: string;
  deliveryPerson: { id: string; name: string } | null;
}

export interface DeliveryStats {
  awaitingCollection: number;
  inTransit: number;
  deliveredToday: number;
  needsAttention: number;
  total: number;
}

export type DateFilter = 'today' | 'tomorrow' | 'all';

interface DeliveryFilters {
  date: DateFilter;
  status: string | null;
  search: string;
}

// ────────────────────────── Fetcher ──────────────────────────

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
};

// ────────────────────────── Hooks ──────────────────────────

export function useDeliveries(filters: DeliveryFilters) {
  const params = new URLSearchParams();
  params.set('date', filters.date);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);

  const { data, error, isLoading } = useSWR<DeliveryOrder[]>(`/api/deliveries?${params}`, fetcher, {
    refreshInterval: 30_000,
    dedupingInterval: 5_000,
  });

  return { deliveries: data ?? [], error, isLoading };
}

export function useDeliveryStats() {
  const { data, error, isLoading } = useSWR<DeliveryStats>('/api/deliveries/stats', fetcher, {
    refreshInterval: 30_000,
    dedupingInterval: 5_000,
  });

  return {
    stats: data ?? {
      awaitingCollection: 0,
      inTransit: 0,
      deliveredToday: 0,
      needsAttention: 0,
      total: 0,
    },
    error,
    isLoading,
  };
}

export function useDeliveryActions() {
  const [loading, setLoading] = useState<string | null>(null);

  const invalidate = useCallback(() => {
    mutate(
      (key: string) => typeof key === 'string' && key.startsWith('/api/deliveries'),
      undefined,
      { revalidate: true }
    );
  }, []);

  const markDelivered = useCallback(
    async (orderId: string, notes?: string) => {
      setLoading('mark-delivered');
      try {
        const res = await fetch(`/api/deliveries/${orderId}/mark-delivered`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: notes || '' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || err.detail || `Failed (${res.status})`);
        }
        invalidate();
        return await res.json();
      } finally {
        setLoading(null);
      }
    },
    [invalidate]
  );

  const markInTransit = useCallback(
    async (orderId: string) => {
      setLoading('mark-in-transit');
      try {
        const res = await fetch(`/api/deliveries/${orderId}/mark-in-transit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || err.detail || `Failed (${res.status})`);
        }
        invalidate();
        return await res.json();
      } finally {
        setLoading(null);
      }
    },
    [invalidate]
  );

  const reschedule = useCallback(
    async (orderId: string, scheduledAt: string) => {
      setLoading('reschedule');
      try {
        const res = await fetch(`/api/deliveries/${orderId}/reschedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledAt }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || err.detail || `Failed (${res.status})`);
        }
        invalidate();
        return await res.json();
      } finally {
        setLoading(null);
      }
    },
    [invalidate]
  );

  return { markDelivered, markInTransit, reschedule, loading };
}
