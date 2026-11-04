import { dashboardApi } from '@/lib/api/services';
import { useQuery } from '@tanstack/react-query';

export interface DashboardOverviewResponse {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    completed: number;
    installationsPending: number;
    customers: { total: number; clv: number };
    products: { total: number };
    activeCustomers: number;
    monthlyGrowth: number;
    serviceLevel: number | null;
  };
  statusCounts: Array<{ status: string; count: number; label: string }>;
  recentOrders: Array<any>;
  map: { features: Array<any> };
  events: Array<any>;
}

export function useDashboardOverview(options?: {
  initialData?: DashboardOverviewResponse;
  refetchInterval?: number | false;
}) {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: async () => {
      const result = await dashboardApi.getOverview();

      if (!result.success) {
        throw new Error(result.error.message || 'Failed to fetch dashboard overview');
      }

      return result.data as DashboardOverviewResponse;
    },
    initialData: options?.initialData,
    refetchInterval: options?.refetchInterval ?? 60 * 1000, // Default to 1m if not specified
    staleTime: 10 * 1000, // 10s stale time for real-time feel
    refetchOnWindowFocus: true,
  });
}
