import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { PaginationMeta } from '@/lib/api/types';

export type UserRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export type UsersResponseShape =
  | {
      data?: UserRecord[] | { users?: UserRecord[]; items?: UserRecord[]; pagination?: PaginationMeta };
      pagination?: PaginationMeta;
      meta?: PaginationMeta;
      users?: UserRecord[];
      items?: UserRecord[];
    }
  | undefined;

export function normalizeUsers(payload: UsersResponseShape) {
  if (!payload) {
    return { items: [] as UserRecord[], pagination: undefined as PaginationMeta | undefined };
  }

  if (Array.isArray(payload.data)) {
    return { items: payload.data, pagination: payload.pagination ?? payload.meta };
  }

  if (payload.data && typeof payload.data === 'object') {
    const embedded = payload.data as any;
    if (Array.isArray(embedded.users)) {
      return { items: embedded.users as UserRecord[], pagination: embedded.pagination ?? payload.pagination ?? payload.meta };
    }
    if (Array.isArray(embedded.items)) {
      return { items: embedded.items as UserRecord[], pagination: embedded.pagination ?? payload.pagination ?? payload.meta };
    }
  }

  if (Array.isArray(payload.users)) {
    return { items: payload.users, pagination: payload.pagination ?? payload.meta };
  }

  if (Array.isArray(payload.items)) {
    return { items: payload.items, pagination: payload.pagination ?? payload.meta };
  }

  return { items: [] as UserRecord[], pagination: payload?.pagination ?? payload?.meta };
}

export function useUsersQuery(enabled = true) {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get<UsersResponseShape>('/api/users');
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch users');
      }
      return normalizeUsers(response.data);
    },
    enabled,
    staleTime: 30_000,
  });
}
