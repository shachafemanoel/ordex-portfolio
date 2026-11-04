import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export interface PaymentsQueryFilters {
  orderId?: string;
  limit?: number;
}

interface PaymentRecord {
  id: string;
  amount?: number | null;
  amountCents?: number | null;
  method?: string | null;
  status?: string | null;
  createdAt?: string;
}

interface PaymentsResponseShape {
  payments?: PaymentRecord[];
  items?: PaymentRecord[];
  data?: PaymentRecord[] | { payments?: PaymentRecord[]; items?: PaymentRecord[] };
}

export function usePaymentsQuery(filters: PaymentsQueryFilters, enabled = true) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: async () => {
      const queryString = buildQueryString(filters);
      const url = queryString ? `/api/payments?${queryString}` : '/api/payments';
      const response = await apiClient.get<PaymentsResponseShape>(url);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch payments');
      }

      return normalizePayments(response.data);
    },
    enabled,
    staleTime: 15_000,
  });
}

function buildQueryString(params: PaymentsQueryFilters): string {
  const usp = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    usp.append(key, String(value));
  });
  return usp.toString();
}

export function normalizePayments(payload: PaymentsResponseShape | undefined) {
  if (!payload) {
    return { items: [] as PaymentRecord[] };
  }

  // Canonical path: { data: PaymentRecord[] }
  if (Array.isArray(payload.data)) {
    return { items: payload.data };
  }

  // Transitional path: { data: { payments: [] } }
  if (payload.data && typeof payload.data === 'object' && Array.isArray((payload.data as any).payments)) {
    return { items: (payload.data as any).payments as PaymentRecord[] };
  }

  // Legacy path: { payments: [] }
  if (Array.isArray(payload.payments)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[usePaymentsQuery] Legacy response shape received; migrate /api/payments to canonical { data }'
      );
    }
    return { items: payload.payments };
  }

  const items: PaymentRecord[] = Array.isArray(payload.items) ? payload.items : [];

  return { items };
}
