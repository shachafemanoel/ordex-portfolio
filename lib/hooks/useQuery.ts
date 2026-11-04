/**
 * React Query hooks for Ordex OMS
 *
 * This file provides centralized data fetching and mutation hooks using @tanstack/react-query.
 * All hooks automatically handle loading states, caching, retries, and error handling.
 *
 * Query hooks (useOrdersQuery, useCustomersQuery, etc.) are for data fetching.
 * Mutation hooks (useCreateOrder, useUpdateOrder, etc.) are for state-changing operations.
 */

'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Appointment,
  Order,
  OrderStatus,
  PaginatedResponse,
  PurchaseOrder,
  Supplier,
} from '../types';
import type { CustomerWithRelations } from '@/lib/api/types';
import type { ClientFormData, OrderFormData } from '@/lib/validation';
import type { OrderCreateInput } from '@/lib/validators/order';

// ============================================================================
// QUERY KEYS
// ============================================================================
// Centralized query keys for cache invalidation and prefetching

export const queryKeys = {
  // Orders
  orders: ['orders'] as const,
  ordersList: (filters?: Record<string, any>) => ['orders', 'list', filters] as const,
  orderDetail: (id: string) => ['orders', 'detail', id] as const,
  ordersMap: (filters?: Record<string, any>) => ['orders', 'map', filters] as const,
  today: ['orders', 'today'] as const,

  // Customers
  customers: ['customers'] as const,
  customersList: (search?: string) => ['customers', 'list', search] as const,
  customerDetail: (id: string) => ['customers', 'detail', id] as const,

  // Suppliers
  suppliers: ['suppliers'] as const,
  suppliersList: (search?: string) => ['suppliers', 'list', search] as const,
  supplierDetail: (id: string) => ['suppliers', 'detail', id] as const,

  // Purchase Orders
  purchaseOrders: ['purchase-orders'] as const,
  purchaseOrdersList: (filters?: Record<string, any>) =>
    ['purchase-orders', 'list', filters] as const,
  purchaseOrderDetail: (id: string) => ['purchase-orders', 'detail', id] as const,

  // Dashboard
  dashboard: ['dashboard'] as const,
  dashboardSummary: ['dashboard', 'summary'] as const,

  // Reports
  reports: ['reports'] as const,
  waitingGoods: (filters?: Record<string, any>) => ['reports', 'waiting-goods', filters] as const,
  waitingInstall: (filters?: Record<string, any>) =>
    ['reports', 'waiting-installation', filters] as const,

  // Calendar
  calendar: ['calendar'] as const,
  calendarEvents: (orderId?: string) => ['calendar', 'events', orderId] as const,
} as const;

// ============================================================================
// ORDERS HOOKS
// ============================================================================

/**
 * Query hook for fetching paginated orders list via ApiClient
 * Use this for more complex filtering and integration with other API methods
 *
 * @example
 * const { data, isLoading, error } = useOrdersQuery({
 *   status: ['TO_DO', 'CALL_BACK'],
 *   page: 1,
 *   limit: 20
 * });
 */
export function useOrdersQuery(
  filters?: {
    status?: OrderStatus[];
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
    userId?: string;
    clientId?: string;
    city?: string;
  },
  options?: Omit<UseQueryOptions<PaginatedResponse<Order>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.ordersList(filters),
    queryFn: async () => {
      const response = await api.getOrders(filters);
      if (!response.success) {
        throw new Error(response.error.message);
      }

      // Map API response to hook's expected format
      return {
        items: response.data.data as Order[],
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        limit: response.data.pagination.perPage,
        meta: {
          total: response.data.pagination.total,
          page: response.data.pagination.page,
          limit: response.data.pagination.perPage,
          totalPages: response.data.pagination.totalPages,
          hasNext: response.data.pagination.hasNext ?? false,
          hasPrev: response.data.pagination.hasPrev ?? false,
        },
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
}

/**
 * Query hook for fetching a single order by ID
 *
 * @example
 * const { data: order, isLoading } = useOrderQuery(orderId);
 */
export function useOrderQuery(
  orderId: string,
  options?: Omit<UseQueryOptions<Order>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.orderDetail(orderId),
    queryFn: async () => {
      const response = await api.getOrder(orderId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 15 * 1000, // 15 seconds
    enabled: !!orderId, // Only run if orderId exists
    ...options,
  });
}

/**
 * Query hook for fetching orders for map visualization
 *
 * @example
 * const { data: mapOrders } = useOrdersMapQuery({ status: ['AWAITING_INSTALL'] });
 */
export function useOrdersMapQuery(
  filters?: {
    status?: OrderStatus[];
    city?: string;
  },
  options?: Omit<UseQueryOptions<any[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.ordersMap(filters),
    queryFn: async () => {
      const response = await api.getOrdersForMap(filters);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

/**
 * Query hook for fetching today's operational data (scheduled & overdue)
 */
export function useTodayOrdersQuery(options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.today,
    queryFn: async () => {
      const response = await api.orders.today();
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    ...options,
  });
}

/**
 * Mutation hook for creating a new order
 *
 * @example
 * const createOrder = useCreateOrderMutation();
 * createOrder.mutate(orderData, {
 *   onSuccess: (order) => console.log('Created:', order.id)
 * });
 */
export function useCreateOrderMutation(
  options?: UseMutationOptions<{ id: string; number: string }, Error, OrderCreateInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: OrderCreateInput) => {
      const response = await api.createInternalOrder(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      // Invalidate orders list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });

      // Call user's onSuccess if provided
      (options?.onSuccess as any)?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hook for updating order status
 *
 * @example
 * const updateStatus = useUpdateOrderStatusMutation();
 * updateStatus.mutate({
 *   orderId: '123',
 *   status: 'PO_CREATED',
 *   reason: 'Supplier confirmed'
 * });
 */
export function useUpdateOrderStatusMutation(
  options?: UseMutationOptions<
    Order,
    Error,
    { orderId: string; status: OrderStatus; reason?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status, reason }) => {
      const response = await api.transition(orderId, {
        toStatus: status,
        note: reason,
      });
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderDetail(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports });

      (options?.onSuccess as any)?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hook for updating an order
 *
 * @example
 * const updateOrder = useUpdateOrderMutation();
 * updateOrder.mutate({ orderId: '123', data: { customerPhone: '050-1234567' } });
 */
export function useUpdateOrderMutation(
  options?: UseMutationOptions<
    Order,
    Error,
    { orderId: string; data: OrderFormData; status?: OrderStatus }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, data, status }) => {
      const response = await api.updateOrder(orderId, { ...data, status });
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderDetail(variables.orderId) });

      (options?.onSuccess as any)?.(data, variables, context);
    },
    ...options,
  });
}

// ============================================================================
// CUSTOMERS HOOKS
// ============================================================================

/**
 * Query hook for fetching customers list
 *
 * @example
 * const { data: customers, isLoading } = useCustomersQuery('search term');
 */
export function useCustomersQuery(
  search?: string,
  options?: Omit<UseQueryOptions<CustomerWithRelations[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.customersList(search),
    queryFn: async () => {
      const response = await api.getClients(search);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute - customer data doesn't change often
    ...options,
  });
}

/**
 * Query hook for fetching a single customer by ID
 *
 * @example
 * const { data: customer } = useCustomerQuery(customerId);
 */
export function useCustomerQuery(
  customerId: string,
  options?: Omit<UseQueryOptions<CustomerWithRelations>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.customerDetail(customerId),
    queryFn: async () => {
      const response = await api.getClient(customerId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 60 * 1000,
    enabled: !!customerId,
    ...options,
  });
}

/**
 * Mutation hook for creating a new customer
 *
 * @example
 * const createCustomer = useCreateCustomerMutation();
 * createCustomer.mutate(customerData);
 */
export function useCreateCustomerMutation(
  options?: UseMutationOptions<CustomerWithRelations, Error, ClientFormData>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ClientFormData) => {
      const response = await api.createClient(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers });

      (options?.onSuccess as any)?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hook for updating a customer
 *
 * @example
 * const updateCustomer = useUpdateCustomerMutation();
 * updateCustomer.mutate({ customerId: '123', data: { name: 'New Name' } });
 */
export function useUpdateCustomerMutation(
  options?: UseMutationOptions<
    CustomerWithRelations,
    Error,
    { customerId: string; data: Partial<ClientFormData> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, data }) => {
      const response = await api.updateClient(customerId, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerDetail(variables.customerId) });

      (options?.onSuccess as any)?.(data, variables, context);
    },
    ...options,
  });
}

/**
 * Mutation hook for deleting a customer
 *
 * @example
 * const deleteCustomer = useDeleteCustomerMutation();
 * deleteCustomer.mutate(customerId);
 */
export function useDeleteCustomerMutation(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerId: string) => {
      const response = await api.deleteClient(customerId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: (data, customerId, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers });
      queryClient.removeQueries({ queryKey: queryKeys.customerDetail(customerId) });

      (options?.onSuccess as any)?.(data, customerId, context);
    },
    ...options,
  });
}

// ============================================================================
// SUPPLIERS HOOKS
// ============================================================================

/**
 * Query hook for fetching suppliers list
 */
export function useSuppliersQuery(
  search?: string,
  options?: Omit<UseQueryOptions<Supplier[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.suppliersList(search),
    queryFn: async () => {
      const response = await api.getSuppliers(search);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 120 * 1000, // 2 minutes - supplier data is fairly static
    ...options,
  });
}

/**
 * Query hook for fetching a single supplier by ID
 */
export function useSupplierQuery(
  supplierId: string,
  options?: Omit<UseQueryOptions<Supplier>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.supplierDetail(supplierId),
    queryFn: async () => {
      const response = await api.getSupplier(supplierId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 120 * 1000,
    enabled: !!supplierId,
    ...options,
  });
}

// ============================================================================
// DASHBOARD HOOKS
// ============================================================================

/**
 * Query hook for fetching dashboard summary data
 *
 * @example
 * const { data: summary } = useDashboardSummaryQuery();
 */
export function useDashboardSummaryQuery(
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: async () => {
      const response = await api.getDashboard();
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
}

/**
 * Query hook for fetching comprehensive dashboard snapshot data
 * Includes KPIs, status counts, 30-day timeline, and recent orders
 *
 * @example
 * const { data: snapshot } = useDashboardSnapshotQuery();
 */
export function useDashboardSnapshotQuery(
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => {
      const response = await api.getDashboardSnapshot();
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
}

// ============================================================================
// PURCHASE ORDERS HOOKS
// ============================================================================

/**
 * Query hook for fetching purchase orders
 */
export function usePurchaseOrdersQuery(
  filters?: {
    supplierId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  },
  options?: Omit<UseQueryOptions<PurchaseOrder[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.purchaseOrdersList(filters),
    queryFn: async () => {
      const response = await api.getPurchaseOrders(filters);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 45 * 1000,
    ...options,
  });
}

/**
 * Mutation hook for generating purchase orders from selected orders
 */
export function useGeneratePurchaseOrdersMutation(
  options?: UseMutationOptions<PurchaseOrder[], Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderIds: string[]) => {
      const response = await api.generatePurchaseOrders(orderIds);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });

      (options?.onSuccess as any)?.(data, variables, context);
    },
    ...options,
  });
}

// ============================================================================
// CALENDAR HOOKS
// ============================================================================

/**
 * Query hook for fetching calendar events
 */
export function useCalendarEventsQuery(
  orderId?: string,
  options?: Omit<UseQueryOptions<Appointment[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.calendarEvents(orderId),
    queryFn: async () => {
      const response = await api.getCalendarEvents(orderId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 60 * 1000,
    ...options,
  });
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook to access the QueryClient for manual cache operations
 *
 * @example
 * const queryClient = useQueryClient();
 * queryClient.invalidateQueries({ queryKey: queryKeys.orders });
 */
export { useQueryClient } from '@tanstack/react-query';
