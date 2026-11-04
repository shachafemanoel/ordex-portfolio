import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/services';
import { productQueryKeys } from '@/lib/hooks/api/products/queryKeys';
import type { ProductDTO } from '@/domain/products/productDTO';

export interface UpdateProductInput {
  id: string;
  data: {
    name?: string;
    sku?: string;
    defaultSupplierId?: string | null;
    basePriceCents?: number | null;
    demoStock?: number | null;
    description?: string | null;
    shortDescription?: string | null;
    imageUrl?: string | null;
    type?: 'SIMPLE' | 'BUNDLE' | 'SERVICE' | 'VARIABLE';
    procurementType?: 'INVENTORY' | 'DROPSHIP' | 'SPECIAL_ORDER';
    isActive?: boolean;
    is_featured?: boolean;
    inventoryEnabled?: boolean;
    reorderLevel?: number;
  };
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateProductInput): Promise<ProductDTO> => {
      const result = await productsApi.update(id, data as any);
      if (!result.success) {
        throw new Error((result.error as any)?.message || 'Failed to update product');
      }
      return result.data as unknown as ProductDTO;
    },
    onSuccess: (product, { id }) => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
      if (product) {
        queryClient.setQueryData(productQueryKeys.detail(id), product);
      }
    },
  });
}
