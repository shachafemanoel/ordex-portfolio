import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Order } from '@/lib/types';
import type { OrderFilterData } from '@/lib/validation';

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  hasMore: boolean;
  selectedOrders: string[];
}

export function useOrdersState(initialFilters: OrderFilterData) {
  const [state, setState] = useState<OrdersState>({
    orders: [],
    loading: true,
    error: null,
    totalCount: 0,
    currentPage: 1,
    hasMore: false,
    selectedOrders: [],
  });

  const [filters, setFilters] = useState<OrderFilterData>(initialFilters);

  // Optimized shallow comparison
  const shallowEqual = useCallback((a: any, b: any): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (Array.isArray(a[key]) && Array.isArray(b[key])) {
        if (a[key].length !== b[key].length) return false;
        for (let i = 0; i < a[key].length; i++) {
          if (a[key][i] !== b[key][i]) return false;
        }
        continue;
      }
      if (a[key] !== b[key]) return false;
    }
    return true;
  }, []);

  const loadOrders = useCallback(
    async (newFilters?: OrderFilterData) => {
      const currentFilters = newFilters || filters;
      setState((prev: OrdersState) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await api.getOrders({
          status: currentFilters.status,
          q: currentFilters.q,
          dateFrom: currentFilters.dateFrom,
          dateTo: currentFilters.dateTo,
          page: currentFilters.page,
          limit: currentFilters.limit,
          sort: currentFilters.sort,
          dir: currentFilters.dir,
          userId: currentFilters.userId,
          clientId: currentFilters.clientId,
          city: currentFilters.city,
        });

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to load orders');
        }

        const data = response.data!;

        setState((prev: OrdersState) => ({
          ...prev,
          orders: data.data,
          totalCount: data.pagination?.total || 0,
          currentPage: data.pagination?.page || 1,
          hasMore: data.pagination?.hasNext || false,
          loading: false,
          selectedOrders: [],
        }));
      } catch (error) {
        setState((prev: OrdersState) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'שגיאה בטעינת ההזמנות',
          loading: false,
        }));
      }
    },
    [filters]
  );

  const updateFilters = useCallback(
    (newFilters: Partial<OrderFilterData>) => {
      setFilters((prev: OrderFilterData) => {
        const next = {
          ...prev,
          ...newFilters,
          page: newFilters.page ?? 1,
        };
        return shallowEqual(prev, next) ? prev : next;
      });
    },
    [shallowEqual]
  );

  const clearFilters = useCallback(() => {
    setFilters((prev: OrderFilterData) => {
      const base = {
        page: 1,
        limit: 20,
        sort: 'createdAt' as const,
        dir: 'desc' as const,
      };
      return shallowEqual(prev, base) ? prev : base;
    });
  }, [shallowEqual]);

  const selectOrders = useCallback((selectedIds: string[]) => {
    setState((prev: OrdersState) => ({ ...prev, selectedOrders: selectedIds }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev: OrdersState) => ({ ...prev, error: null }));
  }, []);

  // Auto-load orders when filters change
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return {
    // State
    ...state,
    filters,

    // Actions
    loadOrders,
    updateFilters,
    clearFilters,
    selectOrders,
    clearError,

    // Utilities
    refresh: () => loadOrders(filters),
  };
}
