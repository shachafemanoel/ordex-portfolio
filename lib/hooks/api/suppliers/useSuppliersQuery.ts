import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export interface SuppliersQueryFilters {
  q?: string;
  page?: number;
  limit?: number;
}

interface SupplierRecord {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  productsCount?: number;
  purchaseOrdersCount?: number;
  lastPurchaseOrderAt?: string | null;
}

interface PaginationMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  nextCursor?: string | null;
}

interface SuppliersResponseShape {
  suppliers?: SupplierRecord[];
  items?: SupplierRecord[];
  data?: SupplierRecord[] | { suppliers?: SupplierRecord[]; items?: SupplierRecord[]; pagination?: PaginationMeta };
  pagination?: PaginationMeta;
  meta?: PaginationMeta;
}

export function useSuppliersQuery(filters: SuppliersQueryFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ['suppliers', filters],
    queryFn: async () => {
      const queryString = buildQueryString(filters);
      const url = queryString ? `/api/suppliers?${queryString}` : '/api/suppliers';
      const response = await apiClient.get<SuppliersResponseShape>(url);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch suppliers');
      }

      return normalizeSuppliers(response.data);
    },
    enabled,
    staleTime: 30_000,
  });
}

function buildQueryString(params: SuppliersQueryFilters): string {
  const usp = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    usp.append(key, String(value));
  });
  return usp.toString();
}

export function normalizeSuppliers(payload: SuppliersResponseShape | undefined) {
  if (!payload) {
    return { items: [], pagination: undefined as PaginationMeta | undefined };
  }

  // Canonical path: { data: SupplierRecord[], pagination }
  if (Array.isArray(payload.data)) {
    return {
      items: payload.data,
      pagination: payload.pagination ?? payload.meta,
    };
  }

  // Transitional path: { data: { items: [] } }
  if (
    payload.data &&
    typeof payload.data === 'object' &&
    Array.isArray((payload.data as any).items)
  ) {
    return {
      items: (payload.data as any).items as SupplierRecord[],
      pagination:
        (payload.data as any).pagination ??
        payload.pagination ??
        payload.meta,
    };
  }

  // Legacy path: { suppliers: [] }
  if (Array.isArray(payload.suppliers)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[useSuppliersQuery] Legacy response shape received; migrate /api/suppliers to canonical { data, pagination }'
      );
    }
    return {
      items: payload.suppliers,
      pagination: payload.pagination ?? payload.meta,
    };
  }

  const items: SupplierRecord[] = Array.isArray(payload.items) ? payload.items : [];
  const pagination: PaginationMeta | undefined =
    payload.pagination ?? payload.meta ?? (payload.data as any)?.pagination;

  return { items, pagination };
}
