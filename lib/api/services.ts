/**
 * API Services
 *
 * High-level API service functions for frontend components and hooks.
 * Uses the modern API client with standardized response formats.
 *
 * @module lib/api/services
 */

import { clearAuthToken, getAuthToken } from '@/lib/auth/tokenStorage';
import { createApiClient, type ApiResult } from '@/lib/api/client';
import type {
  CreateOrderRequest,
  CustomerFilterParams,
  CustomerWithRelations,
  OrderFilterParams,
  OrderWithRelations,
  OrdersListResponse,
  Product,
  ProductFilterParams,
  ProductsListResponse,
} from './types';

// Track if we're already handling a logout to prevent race conditions
let isLoggingOut = false;

// Logout handler that can be set by AuthProvider
let logoutHandler: (() => Promise<void>) | null = null;

export function setLogoutHandler(handler: () => Promise<void>) {
  logoutHandler = handler;
}

async function handleUnauthorized(endpoint: string): Promise<void> {
  // Prevent multiple simultaneous logouts
  if (isLoggingOut) {
    return;
  }

  isLoggingOut = true;

  try {
    console.warn(`Unauthorized response from ${endpoint}. Logging out...`);

    // Clear auth token from localStorage
    clearAuthToken();

    // If a logout handler is registered (from AuthProvider), use it
    if (logoutHandler) {
      await logoutHandler();
    } else {
      // Fallback: redirect to login page
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const loginUrl = `/login?returnTo=${encodeURIComponent(currentPath)}`;
        window.location.href = loginUrl;
      }
    }
  } finally {
    // Reset flag after a delay to allow the redirect/logout to complete
    setTimeout(() => {
      isLoggingOut = false;
    }, 1000);
  }
}

/**
 * Singleton authenticated client instance
 */
let authenticatedClient: ReturnType<typeof createApiClient> | null = null;

/**
 * Create API client with authentication
 */
function createAuthenticatedClient() {
  if (!authenticatedClient) {
    authenticatedClient = createApiClient('/api', () => {
      const token = getAuthToken();
      const headers: HeadersInit = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      return headers;
    });

    // Register 401 handler
    authenticatedClient.setUnauthorizedHandler(handleUnauthorized);
  }

  return authenticatedClient;
}

// ===== Orders API =====

export const ordersApi = {
  /**
   * Get list of orders with filters and pagination
   */
  async list(filters?: OrderFilterParams): Promise<ApiResult<OrdersListResponse>> {
    return createAuthenticatedClient().get<OrdersListResponse>('/orders', filters);
  },

  /**
   * Get single order by ID
   */
  async get(id: string): Promise<ApiResult<OrderWithRelations>> {
    return createAuthenticatedClient().get<OrderWithRelations>(`/orders/${id}`);
  },

  /**
   * Create new order
   */
  async create(data: CreateOrderRequest): Promise<ApiResult<OrderWithRelations>> {
    return createAuthenticatedClient().post<OrderWithRelations>('/orders', data);
  },

  /**
   * Update order
   */
  async update(
    id: string,
    data: Partial<OrderWithRelations>
  ): Promise<ApiResult<OrderWithRelations>> {
    return createAuthenticatedClient().patch<OrderWithRelations>(`/orders/${id}`, data);
  },

  /**
   * Change order status (legacy endpoint)
   */
  async changeStatus(
    id: string,
    status: string,
    reason?: string
  ): Promise<ApiResult<OrderWithRelations>> {
    return createAuthenticatedClient().post<OrderWithRelations>(`/orders/${id}/status`, {
      status,
      reason,
    });
  },

  /**
   * Canonical transition endpoint
   */
  async transition(
    id: string,
    payload: { toStatus: string; note?: string; action?: Record<string, any> }
  ): Promise<ApiResult<OrderWithRelations>> {
    return createAuthenticatedClient().post<OrderWithRelations>(
      `/orders/${id}/transition`,
      payload
    );
  },

  /**
   * Delete order
   */
  async delete(id: string): Promise<ApiResult<void>> {
    return createAuthenticatedClient().delete<void>(`/orders/${id}`);
  },

  /**
   * Get order timeline/history
   */
  async getTimeline(id: string): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>(`/orders/${id}/timeline`);
  },

  /**
   * Get orders for map
   */
  async getForMap(filters?: any): Promise<ApiResult<any[]>> {
    return createAuthenticatedClient().get<any[]>('/orders/geo', filters);
  },

  /**
   * Get today's operational data (scheduled & overdue)
   */
  async today(): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/orders/today');
  },
};

// ===== Customers API =====

export const customersApi = {
  /**
   * Get list of customers
   */
  async list(filters?: CustomerFilterParams): Promise<ApiResult<CustomerWithRelations[]>> {
    const result = await createAuthenticatedClient().get<CustomerWithRelations[]>(
      '/customers',
      filters
    );

    if (!result.success) {
      return result as ApiResult<CustomerWithRelations[]>;
    }

    // Extract data from envelope
    return {
      success: true,
      data: result.data,
      correlationId: result.correlationId,
    } as ApiResult<CustomerWithRelations[]>;
  },

  /**
   * Get single customer by ID
   */
  async get(id: string): Promise<ApiResult<CustomerWithRelations>> {
    return createAuthenticatedClient().get<CustomerWithRelations>(`/customers/${id}`);
  },

  /**
   * Create new customer
   */
  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    creditLimitCents?: number;
    paymentTermsDays?: number;
  }): Promise<ApiResult<CustomerWithRelations>> {
    return createAuthenticatedClient().post<CustomerWithRelations>('/customers', data);
  },

  /**
   * Update customer
   */
  async update(
    id: string,
    data: Partial<CustomerWithRelations>
  ): Promise<ApiResult<CustomerWithRelations>> {
    return createAuthenticatedClient().patch<CustomerWithRelations>(`/customers/${id}`, data);
  },

  /**
   * Delete customer
   */
  async delete(id: string): Promise<ApiResult<void>> {
    return createAuthenticatedClient().delete<void>(`/customers/${id}`);
  },

  /**
   * Get customer orders
   */
  async getOrders(id: string): Promise<ApiResult<OrdersListResponse>> {
    return createAuthenticatedClient().get<OrdersListResponse>(`/customers/${id}/orders`);
  },

  /**
   * Get customer account summary
   */
  async getAccountSummary(id: string): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>(`/customers/${id}/account-summary`);
  },
};

// ===== Products API =====

export const productsApi = {
  /**
   * Get list of products
   */
  async list(filters?: ProductFilterParams): Promise<ApiResult<ProductsListResponse>> {
    const result = await createAuthenticatedClient().get<any>('/products', filters);

    if (!result.success) {
      return result as ApiResult<ProductsListResponse>;
    }

    // Return the full data envelope to preserve pagination metadata
    // result.data contains { items: [...], total, page, limit }
    return {
      success: true,
      data: result.data,
      correlationId: result.correlationId,
    } as ApiResult<ProductsListResponse>;
  },

  /**
   * Get single product by ID
   */
  async get(id: string): Promise<ApiResult<Product>> {
    return createAuthenticatedClient().get<Product>(`/products/${id}`);
  },

  /**
   * Search products
   */
  async search(query: string): Promise<ApiResult<Product[]>> {
    const result = await createAuthenticatedClient().get<Product[]>('/products', {
      search: query,
    });

    if (!result.success) {
      return result as ApiResult<Product[]>;
    }

    return {
      success: true,
      data: result.data,
      correlationId: result.correlationId,
    } as ApiResult<Product[]>;
  },

  /**
   * Create new product
   */
  async create(data: {
    sku: string;
    name: string;
    description?: string;
    category?: string;
    priceCents?: number;
    supplierId?: string;
  }): Promise<ApiResult<Product>> {
    return createAuthenticatedClient().post<Product>('/products', data);
  },

  /**
   * Update product
   */
  async update(id: string, data: Partial<Product>): Promise<ApiResult<Product>> {
    return createAuthenticatedClient().patch<Product>(`/products/${id}`, data);
  },

  /**
   * Delete product
   */
  async delete(id: string): Promise<ApiResult<void>> {
    return createAuthenticatedClient().delete<void>(`/products/${id}`);
  },
};

// ===== Purchase Orders API =====

export const purchaseOrdersApi = {
  /**
   * Get list of purchase orders
   */
  async list(filters?: any): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/purchase-orders', filters);
  },

  /**
   * Get single purchase order by ID
   */
  async get(id: string): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>(`/purchase-orders/${id}`);
  },

  /**
   * Update purchase order status
   */
  async updateStatus(id: string, status: string, notes?: string): Promise<ApiResult<any>> {
    return createAuthenticatedClient().patch<any>(`/purchase-orders/${id}`, {
      status,
      notes,
    });
  },

  /**
   * Update received quantity for a PO item
   */
  async receiveItems(
    id: string,
    poItemId: string,
    quantityReceived: number,
    notes?: string
  ): Promise<ApiResult<any>> {
    // Note: The endpoint is PUT /api/purchase-orders/:id/receive
    return createAuthenticatedClient().put<any>(`/purchase-orders/${id}/receive`, {
      poItemId,
      quantityReceived,
      notes,
    });
  },
};

// ===== Dashboard API =====

export const dashboardApi = {
  /**
   * Get dashboard summary
   */
  async getSummary(): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/dashboard/summary');
  },

  /**
   * Get dashboard metrics
   */
  async getMetrics(): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/dashboard/metrics');
  },

  /**
   * Get dashboard overview (combined data)
   */
  async getOverview(): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/dashboard/overview');
  },
};

// ===== Reports API =====

export const reportsApi = {
  /**
   * Get orders by status report
   */
  async ordersByStatus(filters?: any): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/reports/orders-by-status', filters);
  },

  /**
   * Get awaiting goods report
   */
  async awaitingGoods(filters?: any): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/reports/awaiting-goods', filters);
  },

  /**
   * Get installations report
   */
  async installations(filters?: any): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/reports/installations', filters);
  },
};

// ===== Export all APIs =====

// ===== Integrations API =====

export const integrationsApi = {
  async getIntegrationProviders(): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/integrations/providers');
  },
  async testWooCommerceConnection(data: any): Promise<ApiResult<any>> {
    return createAuthenticatedClient().post<any>('/integrations/woocommerce/test', data);
  },
  async ensureWooCommerceWebhooks(params?: any): Promise<ApiResult<any>> {
    return createAuthenticatedClient().post<any>(
      '/integrations/woocommerce/webhooks/ensure',
      params || {}
    );
  },
  async listWooCommerceWebhooks(): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/integrations/woocommerce/webhooks');
  },
  async deleteWooCommerceWebhook(id: string | number): Promise<ApiResult<any>> {
    return createAuthenticatedClient().delete<any>(`/integrations/woocommerce/webhooks/${id}`);
  },
  async updateWooCommerceOrderStatus(id: string | number, status: string): Promise<ApiResult<any>> {
    return createAuthenticatedClient().post<any>(`/integrations/woocommerce/orders/${id}/status`, {
      status,
    });
  },
  async syncWooCommerceCustomers(options?: {
    batchSize?: number;
    afterDate?: string;
    dryRun?: boolean;
    forceUpdate?: boolean;
  }): Promise<ApiResult<any>> {
    return createAuthenticatedClient().post<any>(
      '/integrations/woocommerce/sync/customers',
      options
    );
  },
  async syncWooCommerceOrders(options?: {
    batchSize?: number;
    afterDate?: string;
    dryRun?: boolean;
    forceUpdate?: boolean;
    createMissingClients?: boolean;
  }): Promise<ApiResult<any>> {
    return createAuthenticatedClient().post<any>('/integrations/woocommerce/sync/orders', options);
  },
  async syncWooCommerceProducts(options?: {
    batchSize?: number;
    afterDate?: string;
    dryRun?: boolean;
    forceUpdate?: boolean;
    includeOutOfStock?: boolean;
  }): Promise<ApiResult<any>> {
    return createAuthenticatedClient().post<any>(
      '/integrations/woocommerce/sync/products',
      options
    );
  },
  async getWooCommerceCustomersPreview(): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/integrations/woocommerce/preview/customers');
  },
  async getWooCommerceOrdersPreview(): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/integrations/woocommerce/preview/orders');
  },
  async getWooCommerceProductsPreview(): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>('/integrations/woocommerce/preview/products');
  },
};

// ===== Users API =====

export const usersApi = {
  async getUsers(filters?: any): Promise<ApiResult<any[]>> {
    return createAuthenticatedClient().get<any[]>('/users', filters);
  },

  async create(data: any): Promise<ApiResult<any>> {
    return createAuthenticatedClient().post<any>('/users', data);
  },

  async update(id: string, data: any): Promise<ApiResult<any>> {
    return createAuthenticatedClient().patch<any>(`/users/${id}`, data);
  },

  async delete(id: string): Promise<ApiResult<void>> {
    return createAuthenticatedClient().delete<void>(`/users/${id}`);
  },

  async generateToken(id: string): Promise<ApiResult<{ token: string }>> {
    return createAuthenticatedClient().post<{ token: string }>(`/users/${id}/token`, {});
  },
};

// ===== Suppliers API =====

export const suppliersApi = {
  async getSuppliers(filters?: any): Promise<ApiResult<any[]>> {
    // Note: Assuming endpoint exists
    return createAuthenticatedClient().get<any[]>('/suppliers', filters);
  },

  async get(id: string): Promise<ApiResult<any>> {
    return createAuthenticatedClient().get<any>(`/suppliers/${id}`);
  },
};

// ===== Calendar API =====

export const calendarApi = {
  async getEvents(orderId?: string): Promise<ApiResult<any[]>> {
    return createAuthenticatedClient().get<any[]>('/calendar', { orderId });
  },
};

// ===== Labels API =====

export const labelsApi = {
  async list(filters?: { stage?: string }): Promise<ApiResult<any[]>> {
    return createAuthenticatedClient().get<any[]>('/labels', filters);
  },

  async create(data: { name: string; color?: string; stage?: string }): Promise<ApiResult<any>> {
    return createAuthenticatedClient().post<any>('/labels', data);
  },

  async update(
    id: string,
    data: { name?: string; color?: string; stage?: string }
  ): Promise<ApiResult<any>> {
    return createAuthenticatedClient().patch<any>(`/labels/${id}`, data);
  },

  async delete(id: string): Promise<ApiResult<void>> {
    return createAuthenticatedClient().delete<void>(`/labels/${id}`);
  },

  async assignToOrder(
    orderId: string,
    labelId: string,
    action: 'assign' | 'unassign'
  ): Promise<ApiResult<any>> {
    return createAuthenticatedClient().post<any>(`/orders/${orderId}/labels`, { labelId, action });
  },

  async setOrderLabels(orderId: string, labelIds: string[]): Promise<ApiResult<any>> {
    return createAuthenticatedClient().post<any>(`/orders/${orderId}/labels`, { labelIds });
  },
};

// ===== Export all APIs =====

export const api = {
  orders: {
    ...ordersApi,
    // Add missing order methods
    scheduleInstallation: async (id: string, payload: any) =>
      createAuthenticatedClient().patch<any>(`/orders/${id}/schedule`, payload),
    clearInstallationSchedule: async (id: string) =>
      createAuthenticatedClient().delete<any>(`/orders/${id}/schedule`),
    // Aliases potentially used
    updateOrder: (id: string, data: any) => ordersApi.update(id, data),
    updateOrderStatus: (
      id: string,
      status: string,
      reasonOrPayload?: string | { reason?: string; [key: string]: any }
    ) => {
      const note =
        typeof reasonOrPayload === 'string'
          ? reasonOrPayload
          : (reasonOrPayload?.reason ?? undefined);

      const action =
        typeof reasonOrPayload === 'object'
          ? Object.fromEntries(Object.entries(reasonOrPayload).filter(([key]) => key !== 'reason'))
          : undefined;

      return ordersApi.transition(id, { toStatus: status, note, action });
    },
    transition: (id: string, payload: { toStatus: string; note?: string; action?: any }) =>
      ordersApi.transition(id, payload),
    // Changed to PATCH
    updateOrderItems: async (id: string, items: any[]) =>
      createAuthenticatedClient().patch<any>(`/orders/${id}/items`, { items }),
    getOrder: (id: string) => ordersApi.get(id),
    getForMap: (filters?: any) => ordersApi.getForMap(filters),
    setLabels: (id: string, labelIds: string[]) => labelsApi.setOrderLabels(id, labelIds),
    toggleLabel: (id: string, labelId: string, action: 'assign' | 'unassign') =>
      labelsApi.assignToOrder(id, labelId, action),
  },
  customers: customersApi,
  products: productsApi,
  purchaseOrders: purchaseOrdersApi,
  dashboard: dashboardApi,
  calendar: calendarApi,
  labels: labelsApi,
  reports: {
    ...reportsApi,
    getWaitingStockFull: async (filters?: any) =>
      createAuthenticatedClient().get<any>('/reports/waiting-stock/full', filters),
  },
  integrations: integrationsApi,
  users: usersApi,
  suppliers: suppliersApi,

  // Direct shortcuts for backward compatibility or ease of use
  createInternalOrder: (data: any) => ordersApi.create(data),
  getOrders: (filters?: any) => ordersApi.list(filters),
  getOrder: (id: string) => ordersApi.get(id),
  updateOrder: (id: string, data: any) => ordersApi.update(id, data),
  transition: (id: string, payload: any) => ordersApi.transition(id, payload),
  getOrdersForMap: (filters?: any) => ordersApi.getForMap(filters),

  // Customers
  getClients: (filters?: any) => customersApi.list(filters),
  getClient: (id: string) => customersApi.get(id),
  createClient: (data: any) => customersApi.create(data),
  updateClient: (id: string, data: any) => customersApi.update(id, data),
  deleteClient: (id: string) => customersApi.delete(id),

  // Suppliers
  getSuppliers: (filters?: any) => suppliersApi.getSuppliers(filters),
  getSupplier: (id: string) => suppliersApi.get(id),

  // Dashboard
  getDashboard: () => dashboardApi.getOverview(),
  getDashboardSnapshot: () => dashboardApi.getOverview(),

  // POs
  getPurchaseOrder: (id: string) => purchaseOrdersApi.get(id),
  getPurchaseOrders: (filters?: any) => purchaseOrdersApi.list(filters),
  updatePurchaseOrderStatus: (id: string, status: string, notes?: string) =>
    purchaseOrdersApi.updateStatus(id, status, notes),
  // Implemented call to actual endpoint
  generatePurchaseOrders: async (orderIds: string[], notes?: string, expectedDelivery?: Date) => {
    return createAuthenticatedClient().post<any>('/purchase-orders/generate', {
      orderIds,
      notes,
      expectedDelivery,
    });
  },

  // Calendar
  getCalendarEvents: (orderId?: string) => calendarApi.getEvents(orderId),

  getWaitingStockFull: (filters?: any) =>
    createAuthenticatedClient().get<any>('/reports/waiting-stock/full', filters),
  getIntegrationProviders: () => integrationsApi.getIntegrationProviders(),
  getNotificationLogs: (filters?: any) =>
    createAuthenticatedClient().get<any>('/notifications/logs', filters),
  getPurchaseReport: (filters?: any) =>
    createAuthenticatedClient().get<any>('/reports/purchase', filters),
  getWaitingInstallOrders: (filters?: any) =>
    createAuthenticatedClient().get<any>('/reports/waiting-installation', filters),

  // WooCommerce shortcuts
  testWooCommerceConnection: (data?: any) => integrationsApi.testWooCommerceConnection(data || {}),
  ensureWooCommerceWebhooks: (params?: any) => integrationsApi.ensureWooCommerceWebhooks(params),
  listWooCommerceWebhooks: () => integrationsApi.listWooCommerceWebhooks(),
  deleteWooCommerceWebhook: (id: string | number) => integrationsApi.deleteWooCommerceWebhook(id),
  updateWooCommerceOrderStatus: (id: string | number, status: string) =>
    integrationsApi.updateWooCommerceOrderStatus(id, status),
  syncWooCommerceCustomers: (options?: {
    batchSize?: number;
    afterDate?: string;
    dryRun?: boolean;
    forceUpdate?: boolean;
  }) => integrationsApi.syncWooCommerceCustomers(options),
  syncWooCommerceOrders: (options?: {
    batchSize?: number;
    afterDate?: string;
    dryRun?: boolean;
    forceUpdate?: boolean;
    createMissingClients?: boolean;
  }) => integrationsApi.syncWooCommerceOrders(options),
  syncWooCommerceProducts: (options?: {
    batchSize?: number;
    afterDate?: string;
    dryRun?: boolean;
    forceUpdate?: boolean;
    includeOutOfStock?: boolean;
  }) => integrationsApi.syncWooCommerceProducts(options),
  getWooCommerceCustomersPreview: () => integrationsApi.getWooCommerceCustomersPreview(),
  getWooCommerceOrdersPreview: () => integrationsApi.getWooCommerceOrdersPreview(),
  getWooCommerceProductsPreview: () => integrationsApi.getWooCommerceProductsPreview(),
};

export default api;
