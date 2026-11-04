import { api } from '@/lib/api';
import type { Order } from '@/lib/types';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { orderQueryKeys } from '@/lib/hooks/api/orders/queryKeys';
import { toOrdersApiError } from '@/lib/hooks/api/orders/errors';

export type UseOrderQueryOptions = Omit<UseQueryOptions<Order>, 'queryKey' | 'queryFn'>;

function unwrapOrderDetailPayload(payload: unknown): Order {
  if (payload && typeof payload === 'object' && 'order' in (payload as Record<string, unknown>)) {
    return (payload as { order: Order }).order;
  }

  return payload as Order;
}

export function useOrderQuery(
  orderId: string,
  options?: UseOrderQueryOptions
) {
  return useQuery({
    queryKey: orderQueryKeys.detail(orderId),
    queryFn: async () => {
      const response = await api.getOrder(orderId);
      if (!response.success) {
        throw toOrdersApiError(response.error, 'Failed to fetch order');
      }
      return unwrapOrderDetailPayload(response.data);
    },
    staleTime: 15 * 1000,
    enabled: !!orderId,
    select: (data) => unwrapOrderDetailPayload(data),
    retry: (failureCount, error) => {
      const apiError = toOrdersApiError(error);
      if (apiError.status && [400, 401, 403, 404].includes(apiError.status)) {
        return false;
      }
      return failureCount < 2;
    },
    ...options,
  });
}
