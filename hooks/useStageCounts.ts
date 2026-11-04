'use client';

import { useQuery } from '@tanstack/react-query';
import { SupplyStage } from '@/lib/supply-chain/stages';

export type StageCountsData = Record<SupplyStage, number>;

async function fetchStageCounts(): Promise<StageCountsData> {
  const res = await fetch('/api/pipeline/stage-counts');
  if (!res.ok) {
    throw new Error('Failed to fetch stage counts');
  }
  return res.json();
}

/**
 * React Query hook to fetch live counts of orders in each supply chain stage
 * Refreshes every 30 seconds to keep badge counts up-to-date
 */
export function useStageCounts() {
  return useQuery({
    queryKey: ['stageCounts'],
    queryFn: fetchStageCounts,
    refetchInterval: 30000, // Refresh every 30s
    staleTime: 10000, // Consider data stale after 10s
  });
}
