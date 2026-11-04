import { OrderStatus } from '@prisma/client';
import { useQuery } from '@tanstack/react-query';

export type StatusDistributionResponse = Record<
  OrderStatus,
  { _count: { id: number }; _sum: { totalCents: number | null } }
>;

import { apiClient } from '@/lib/apiClient';

async function fetchStatusDistribution(dateRange?: { from?: Date; to?: Date }) {
  const params = new URLSearchParams();
  if (dateRange?.from) params.append('from', dateRange.from.toISOString());
  if (dateRange?.to) params.append('to', dateRange.to.toISOString());

  const response = await apiClient.get<StatusDistributionResponse>(
    `/api/analytics/status-distribution?${params.toString()}`
  );

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to fetch status distribution');
  }

  return response.data;
}

export function useStatusDistribution(dateRange?: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ['analytics', 'status-distribution', dateRange],
    queryFn: () => fetchStatusDistribution(dateRange),
  });
}
