import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api/services';
import { orderQueryKeys } from '@/lib/hooks/api/orders/queryKeys';
import type { OrderStatus } from '@prisma/client';

export interface StatusChangePayload {
  status: OrderStatus;
  reason?: string;
  installAt?: string;
  installerName?: string;
  installerNotes?: string;
}

export function useChangeOrderStatusMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: StatusChangePayload) => {
      const result = await ordersApi.changeStatus(id, data.status, data.reason);
      if (!result.success) {
        throw new Error(result.error.message || 'Failed to change order status');
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
