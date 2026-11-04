import type { PurchaseOrderDTO } from '@/domain/purchase-orders/types';
import type { PurchaseOrderFilters } from '@/lib/purchase-orders';
import { useApiQuery } from '@/hooks/useApiQuery';

export const usePurchaseOrders = (filters?: PurchaseOrderFilters) => {
  const queryKey = ['purchaseOrders', filters]; // Unique key for caching

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
    const response = await fetch(`/api/purchase-orders?${params.toString()}`);
    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error };
    }
    const data = await response.json();
    return { success: true, data: data.data };
  };

  return useApiQuery<PurchaseOrderDTO[]>(queryKey.join('-'), queryFn);
};
