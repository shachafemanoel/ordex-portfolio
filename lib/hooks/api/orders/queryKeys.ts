import type { OrderFilterParams } from '@/lib/api/types';

export const orderQueryKeys = {
  all: ['orders'] as const,
  lists: () => [...orderQueryKeys.all, 'list'] as const,
  list: (filters: OrderFilterParams = {}) => [...orderQueryKeys.lists(), { filters }] as const,
  details: () => [...orderQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderQueryKeys.details(), id] as const,
  timeline: (id: string) => [...orderQueryKeys.detail(id), 'timeline'] as const,
};
