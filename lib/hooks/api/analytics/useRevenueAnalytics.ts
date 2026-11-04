import { apiClient } from '@/lib/apiClient';
import { useQuery } from '@tanstack/react-query';

export interface RevenueDataPoint {
  date: string; // ISO string
  revenue: number;
  ordersCount: number;
}

async function fetchRevenue(
  dateRange?: { from?: Date; to?: Date },
  interval: 'day' | 'month' = 'month'
) {
  const params = new URLSearchParams();
  if (dateRange?.from) params.append('from', dateRange.from.toISOString());
  if (dateRange?.to) params.append('to', dateRange.to.toISOString());
  params.append('interval', interval);

  const response = await apiClient.get<RevenueDataPoint[]>(
    `/api/analytics/revenue?${params.toString()}`
  );

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to fetch revenue data');
  }

  return response.data;
}

export function useRevenueAnalytics(
  dateRange?: { from?: Date; to?: Date },
  interval: 'day' | 'month' = 'month'
) {
  return useQuery({
    queryKey: ['analytics', 'revenue', dateRange, interval],
    queryFn: () => fetchRevenue(dateRange, interval),
  });
}
