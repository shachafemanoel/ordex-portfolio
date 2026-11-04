import type { GoodsReceiptDTO } from '@/domain/goods-receipts/types';
import type { GoodsReceiptFilters } from '@/lib/goods-receipts';
import { useApiQuery } from '@/hooks/useApiQuery';

export const useGoodsReceipts = (filters?: GoodsReceiptFilters) => {
  const queryKey = ['goodsReceipts', filters]; // Unique key for caching

  const queryFn = async () => {
    const params = new URLSearchParams();
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          if (value instanceof Date) {
            params.append(key, value.toISOString());
          } else {
            params.append(key, String(value));
          }
        }
      }
    }
    const response = await fetch(`/api/goods-receipts?${params.toString()}`);
    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error };
    }
    const data = await response.json();
    return { success: true, data: data.data };
  };

  return useApiQuery<GoodsReceiptDTO[]>(queryKey.join('-'), queryFn);
};
