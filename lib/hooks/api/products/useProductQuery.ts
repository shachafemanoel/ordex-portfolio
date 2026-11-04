import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/services';
import { productQueryKeys } from '@/lib/hooks/api/products/queryKeys';
import type { ProductDTO } from '@/domain/products/productDTO';

export function useProductQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: productQueryKeys.detail(id),
    queryFn: async (): Promise<ProductDTO> => {
      const result = await productsApi.get(id);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch product');
      }
      return result.data as unknown as ProductDTO;
    },
    enabled: enabled && !!id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
