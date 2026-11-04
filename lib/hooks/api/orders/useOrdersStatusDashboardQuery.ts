import apiClient from '@/lib/apiClient';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { OrdersApiError, toOrdersApiError } from '@/lib/hooks/api/orders/errors';

export interface StatusSummaryRow {
  status: string;
  count: number;
  totalAmount?: number;
}

export interface StatusDashboardResponse {
  report_type?: string;
  filters_applied?: Record<string, unknown>;
  summary?: StatusSummaryRow[];
  rows?: unknown[];
}

export interface UseOrdersStatusDashboardQueryParams {
  enabled?: boolean;
  options?: Omit<
    UseQueryOptions<StatusDashboardResponse, OrdersApiError, StatusDashboardResponse>,
    'queryKey' | 'queryFn'
  >;
}

async function fetchOrdersStatusDashboard(): Promise<StatusDashboardResponse> {
  const result = await apiClient.get<{ statusCounts?: Record<string, number> }>('/api/orders/dashboard');

  if (!result.success) {
    throw toOrdersApiError(result.error, 'Failed to fetch status dashboard');
  }

  const statusCounts = result.data?.statusCounts ?? {};

  return {
    report_type: 'orders-status-dashboard',
    summary: Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    })),
  };
}

export function useOrdersStatusDashboardQuery(params: UseOrdersStatusDashboardQueryParams = {}) {
  const { enabled = true, options } = params;

  return useQuery({
    queryKey: ['orders', 'status-dashboard'],
    queryFn: fetchOrdersStatusDashboard,
    enabled,
    refetchInterval: 30_000,
    staleTime: 20_000,
    ...options,
  });
}
