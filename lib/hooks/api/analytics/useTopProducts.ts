import { useQuery } from '@tanstack/react-query';

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

import { apiClient } from '@/lib/apiClient';

async function fetchTopProducts(limit: number = 5) {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());

  const response = await apiClient.get<TopProduct[]>(
    `/api/analytics/top-products?${params.toString()}`
  );

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to fetch top products');
  }

  return response.data;
}

export function useTopProducts(limit: number = 5) {
  return useQuery({
    queryKey: ['analytics', 'top-products', limit],
    queryFn: () => fetchTopProducts(limit),
  });
}
