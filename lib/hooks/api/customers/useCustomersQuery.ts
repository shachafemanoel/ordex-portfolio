import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/services';
import type { CustomerFilterParams, CustomerWithRelations } from '@/lib/api/types';

export interface CustomersQueryFilters extends CustomerFilterParams {
  // Additional UI-specific filter options can be added here
}

export function useCustomersQuery(filters: CustomersQueryFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: async () => {
      const result = await customersApi.list(filters);

      if (!result.success) {
        throw new Error(result.error.message || 'Failed to fetch customers');
      }

      // Result.data may be either the array itself or a { data, pagination } envelope.
      const payload: any = result.data;
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : [];
      const pagination = payload?.pagination;

      return {
        items,
        pagination,
      };
    },
    enabled,
    staleTime: 30_000,
  });
}
