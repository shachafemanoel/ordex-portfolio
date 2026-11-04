import { keepPreviousData, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api/services';
import { orderQueryKeys } from '@/lib/hooks/api/orders/queryKeys';
import type {
  OrderFilterParams,
  OrderWithRelations,
  OrdersListResponse,
  PaginationMeta,
} from '@/lib/api/types';
import { OrdersApiError, toOrdersApiError } from '@/lib/hooks/api/orders/errors';

export interface UseOrdersQueryParams {
  filters?: OrderFilterParams;
  pagination?: {
    cursor?: string;
    limit?: number;
    page?: number;
  };
  enabled?: boolean;
  options?: Omit<
    UseQueryOptions<OrdersQueryData, OrdersApiError, OrdersQueryData>,
    'queryKey' | 'queryFn'
  >;
}

export interface OrdersQueryData {
  items: OrderWithRelations[];
  pagination: PaginationMeta;
}

export function normalizeOrdersListResponse(payload: OrdersListResponse): OrdersQueryData {
  if (!payload) {
    return {
      items: [],
      pagination: { total: 0, page: 1, perPage: 0, totalPages: 1 } satisfies PaginationMeta,
    };
  }

  let items: OrderWithRelations[] = [];

  if (Array.isArray((payload as any).data)) {
    items = (payload as any).data as OrderWithRelations[];
  } else if (Array.isArray((payload as any).items)) {
    items = (payload as any).items as OrderWithRelations[];
  } else if (payload.data && typeof payload.data === 'object') {
    const objValues = Object.values(payload.data as unknown as Record<string, OrderWithRelations>);
    if (objValues.length) {
      items = objValues;
    }
  }

  const pagination =
    payload.pagination ??
    (payload as any).meta ??
    ({
      total: items.length,
      page: 1,
      perPage: items.length || 0,
      totalPages: 1,
    } satisfies PaginationMeta);

  return { items, pagination };
}

export function useOrdersQuery(params: UseOrdersQueryParams = {}) {
  const { filters = {}, pagination, enabled = true, options } = params;

  // Merge pagination params into filters for API call
  const mergedFilters = {
    ...filters,
    ...(pagination?.limit && { limit: pagination.limit }),
    ...(pagination?.cursor && { cursor: pagination.cursor }),
    ...(pagination?.page && { page: pagination.page }),
  };

  return useQuery({
    queryKey: orderQueryKeys.list(mergedFilters),
    queryFn: async () => {
      const result = await ordersApi.list(mergedFilters);

      if (!result.success) {
        throw toOrdersApiError(result.error, 'Failed to fetch orders');
      }

      return normalizeOrdersListResponse(result.data);
    },
    enabled,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      const apiError = toOrdersApiError(error);
      if (apiError.status && [400, 401, 403].includes(apiError.status)) {
        return false;
      }
      return failureCount < 2;
    },
    ...options,
  });
}
