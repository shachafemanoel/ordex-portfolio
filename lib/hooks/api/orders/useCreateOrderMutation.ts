import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api/services';
import { orderQueryKeys } from '@/lib/hooks/api/orders/queryKeys';
import type { CreateOrderRequest, OrderWithRelations } from '@/lib/api/types';

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOrderRequest) => {
      const result = await ordersApi.create(data);
      if (!result.success) {
        throw new Error(result.error.message || 'Failed to create order');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });
    },
  });
}
