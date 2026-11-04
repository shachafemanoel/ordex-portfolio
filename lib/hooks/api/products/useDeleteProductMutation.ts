import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/services';
import { productQueryKeys } from '@/lib/hooks/api/products/queryKeys';

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const result = await productsApi.delete(id);
      if (!result.success) {
        throw new Error((result.error as any)?.message || 'Failed to delete product');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
    },
  });
}
