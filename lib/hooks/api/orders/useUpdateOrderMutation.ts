import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api/services';
import { orderQueryKeys } from '@/lib/hooks/api/orders/queryKeys';
import type { OrderWithRelations } from '@/lib/api/types';

export function useUpdateOrderMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<OrderWithRelations>) => {
      const result = await ordersApi.update(id, data);
      if (!result.success) {
        throw new Error(result.error.message || 'Failed to update order');
      }
      return result.data;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(id) });

      // Update cache with new order data
      if (order) {
        queryClient.setQueryData(orderQueryKeys.detail(id), order);
      }
    },
  });
}
