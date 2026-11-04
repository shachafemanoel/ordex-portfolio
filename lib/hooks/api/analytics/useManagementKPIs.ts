import { useQuery } from '@tanstack/react-query';

export interface ManagementKPIs {
  totalRevenue: number;
  totalOrders: number;
  activeCustomers: number;
  newCustomers: number;
}

import { apiClient } from '@/lib/apiClient';

async function fetchKPIs(dateRange?: { from?: Date; to?: Date }) {
  const params = new URLSearchParams();
  if (dateRange?.from) params.append('from', dateRange.from.toISOString());
  if (dateRange?.to) params.append('to', dateRange.to.toISOString());

  const response = await apiClient.get<ManagementKPIs>(`/api/analytics/kpis?${params.toString()}`);

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to fetch KPIs');
  }

  return response.data;
}

export function useManagementKPIs(dateRange?: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ['analytics', 'kpis', dateRange],
    queryFn: () => fetchKPIs(dateRange),
  });
}
