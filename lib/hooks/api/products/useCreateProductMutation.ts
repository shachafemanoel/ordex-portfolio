import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/lib/api/services';
import { productQueryKeys } from '@/lib/hooks/api/products/queryKeys';
import type { ProductDTO } from '@/domain/products/productDTO';

export interface CreateProductInput {
  name: string;
  sku: string;
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
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProductInput): Promise<ProductDTO> => {
      const result = await productsApi.create({
        name: data.name,
        sku: data.sku,
        description: data.description ?? undefined,
        category: undefined,
        priceCents: data.basePriceCents ?? undefined,
        supplierId: data.defaultSupplierId ?? undefined,
      });

      if (!result.success) {
        throw new Error((result.error as any)?.message || 'Failed to create product');
      }

      return result.data as unknown as ProductDTO;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
    },
  });
}
