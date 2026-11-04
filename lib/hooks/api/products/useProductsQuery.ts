import { keepPreviousData, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/services';
import { productQueryKeys } from '@/lib/hooks/api/products/queryKeys';
import type { ProductFilterParams, ProductsListResponse } from '@/lib/api/types';
import type { ProductDTO } from '@/domain/products/productDTO';

export interface ProductsQueryFilters extends ProductFilterParams {
  /** Alias for `search` — maps to the API search param */
  q?: string;
}

export interface ProductsQueryData {
  items: ProductDTO[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UseProductsQueryParams {
  filters?: ProductsQueryFilters;
  enabled?: boolean;
  options?: Omit<
    UseQueryOptions<ProductsQueryData, Error, ProductsQueryData>,
    'queryKey' | 'queryFn'
  >;
}

export function useProductsQuery(
  filtersOrParams: ProductsQueryFilters | UseProductsQueryParams = {},
  enabledLegacy?: boolean
) {
  // Support both legacy call signature useProductsQuery(filters, enabled)
  // and new object signature useProductsQuery({ filters, enabled, options })
  const isLegacy = !('filters' in filtersOrParams) || typeof filtersOrParams.filters === 'undefined';
  const params: UseProductsQueryParams = isLegacy
    ? { filters: filtersOrParams as ProductsQueryFilters, enabled: enabledLegacy }
    : (filtersOrParams as UseProductsQueryParams);

  const { filters = {}, enabled = true, options } = params;

  const apiFilters: ProductFilterParams = {
    ...filters,
    // Map 'q' shorthand to 'search' param expected by the API
    search: filters.q || filters.search,
  };

  return useQuery({
    queryKey: productQueryKeys.list(apiFilters),
    queryFn: async (): Promise<ProductsQueryData> => {
      const result = await productsApi.list(apiFilters);

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch products');
      }

      const data = result.data as ProductsListResponse;
      const items = (data?.items ?? []) as unknown as ProductDTO[];
      const total = data?.total ?? 0;
      const limit = data?.limit ?? 20;

      return {
        items,
        pagination: {
          total,
          page: data?.page ?? 1,
          limit,
          totalPages: Math.ceil(total / (limit || 1)),
        },
      };
    },
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: (failureCount, error: any) => {
      if (error?.status && [400, 401, 403].includes(error.status)) return false;
      return failureCount < 2;
    },
    ...options,
  });
}
