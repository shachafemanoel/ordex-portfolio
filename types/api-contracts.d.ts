/**
 * Type-Safe API Contracts for Ordex OMS
 * End-to-end type safety between client and server
 */

import type { z } from 'zod';
import type { OrderStatus, UserRole, PurchaseOrderStatus } from '@/lib/types';
import type { 
  Brand,
  OrderId,
  UserId, 
  SupplierId,
  SkuId,
  ClientId,
  PurchaseOrderId,
  Result,
  DeepReadonly,
  NonEmptyArray
} from './utilities';

// ==================== BASE API TYPES ====================

/**
 * Standard API response envelope
 */
export interface ApiResponse<TData = unknown, TMeta = unknown> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: ApiError;
  readonly meta?: TMeta;
  readonly timestamp: string;
  readonly requestId?: string;
}

/**
 * Success response type
 */
export interface ApiSuccessResponse<TData, TMeta = unknown> extends ApiResponse<TData, TMeta> {
  readonly success: true;
  readonly data: TData;
  readonly error?: never;
}

/**
 * Error response type
 */
export interface ApiErrorResponse extends ApiResponse<never> {
  readonly success: false;
  readonly data?: never;
  readonly error: ApiError;
}

/**
 * API error structure
 */
export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly field?: string;
  readonly stack?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly meta: PaginationMeta;
}

// ==================== HTTP METHOD TYPES ====================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Route parameter extraction from path template
 */
export type RouteParams<TPath extends string> = 
  TPath extends `${infer _Start}[${infer Param}]${infer Rest}`
    ? { [K in Param]: string } & RouteParams<Rest>
    : {};

/**
 * Query parameter types with validation
 */
export interface BaseQueryParams {
  readonly page?: number;
  readonly limit?: number;
  readonly sort?: string;
  readonly dir?: 'asc' | 'desc';
}

// ==================== DOMAIN ENTITY CONTRACTS ====================

/**
 * Order entity contract
 */
export interface OrderContract {
  readonly id: OrderId;
  readonly number: number;
  readonly customerName: string;
  readonly customerEmail?: string;
  readonly customerPhone?: string;
  readonly totalAmount: number;
  readonly address: string;
  readonly city?: string;
  readonly houseNumber?: string;
  readonly floor?: string;
  readonly note?: string;
  readonly status: OrderStatus;
  readonly installAt?: string; // ISO8601
  readonly installerName?: string;
  readonly installerNotes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly userId?: UserId;
  readonly clientId?: ClientId;
}

/**
 * Order with populated relations
 */
export interface OrderWithRelations extends OrderContract {
  readonly user?: UserContract;
  readonly client?: ClientContract;
  readonly items: readonly OrderItemContract[];
  readonly purchaseLinks?: readonly PurchaseOrderLinkContract[];
  readonly calendarEvents?: readonly CalendarEventContract[];
  readonly statusHistory?: readonly StatusHistoryContract[];
}

/**
 * Order item contract
 */
export interface OrderItemContract {
  readonly id: string;
  readonly orderId: OrderId;
  readonly skuId?: SkuId;
  readonly qty: number;
  readonly received: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sku?: SkuContract;
}

/**
 * User contract
 */
export interface UserContract {
  readonly id: UserId;
  readonly email: string;
  readonly name?: string;
  readonly role: UserRole;
  readonly isActive: boolean;
  readonly lastLoginAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Supplier contract
 */
export interface SupplierContract {
  readonly id: SupplierId;
  readonly name: string;
  readonly taxId?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly address?: string;
  readonly contactPerson?: string;
  readonly website?: string;
  readonly notes?: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * SKU contract
 */
export interface SkuContract {
  readonly id: SkuId;
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly price?: number;
  readonly supplierId?: SupplierId;
  readonly stock?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly supplier?: SupplierContract;
}

/**
 * Client contract
 */
export interface ClientContract {
  readonly id: ClientId;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly address?: string;
  readonly city?: string;
  readonly taxId?: string;
  readonly contactPerson?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Purchase Order contract
 */
export interface PurchaseOrderContract {
  readonly id: PurchaseOrderId;
  readonly supplierId: SupplierId;
  readonly status: PurchaseOrderStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly supplier?: SupplierContract;
  readonly links: readonly PurchaseOrderLinkContract[];
}

/**
 * Purchase Order Link contract
 */
export interface PurchaseOrderLinkContract {
  readonly id: string;
  readonly poId: PurchaseOrderId;
  readonly orderId: OrderId;
}

/**
 * Status History contract
 */
export interface StatusHistoryContract {
  readonly id: string;
  readonly orderId: OrderId;
  readonly fromStatus?: OrderStatus;
  readonly toStatus: OrderStatus;
  readonly changedBy?: UserId;
  readonly reason?: string;
  readonly createdAt: string;
}

/**
 * Calendar Event contract
 */
export interface CalendarEventContract {
  readonly id: string;
  readonly orderId: OrderId;
  readonly title: string;
  readonly description?: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly location?: string;
  readonly attendees?: readonly string[];
  readonly googleEventId?: string;
  readonly status: 'scheduled' | 'confirmed' | 'canceled' | 'completed';
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ==================== REQUEST/RESPONSE CONTRACTS ====================

/**
 * Orders API contracts
 */
export namespace OrdersAPI {
  // GET /api/orders
  export interface ListQuery extends BaseQueryParams {
    readonly status?: readonly OrderStatus[];
    readonly q?: string;
    readonly dateFrom?: string;
    readonly dateTo?: string;
    readonly userId?: UserId;
    readonly clientId?: ClientId;
    readonly city?: string;
  }

  export type ListResponse = ApiSuccessResponse<
    PaginatedResponse<OrderWithRelations>
  >;

  // POST /api/orders
  export interface CreateRequest {
    readonly customerName: string;
    readonly customerEmail?: string;
    readonly customerPhone?: string;
    readonly address: string;
    readonly city?: string;
    readonly houseNumber?: string;
    readonly floor?: string;
    readonly note?: string;
    readonly totalAmount: number;
    readonly items: readonly {
      readonly skuId?: SkuId;
      readonly qty: number;
    }[];
  }

  export type CreateResponse = ApiSuccessResponse<OrderWithRelations>;

  // GET /api/orders/[id]
  export type GetByIdParams = RouteParams<'/api/orders/[id]'>;
  export type GetByIdResponse = ApiSuccessResponse<OrderWithRelations>;

  // PATCH /api/orders/[id]/status  
  export type UpdateStatusParams = RouteParams<'/api/orders/[id]/status'>;
  
  export interface UpdateStatusRequest {
    readonly status: OrderStatus;
    readonly reason?: string;
    readonly installAt?: string;
    readonly installerName?: string;
    readonly installerNotes?: string;
  }

  export type UpdateStatusResponse = ApiSuccessResponse<{
    readonly order: OrderWithRelations;
    readonly statusHistory: StatusHistoryContract;
  }>;

  // PATCH /api/orders/[id]/schedule
  export interface ScheduleRequest {
    readonly installAt: string;
    readonly installerName?: string | null;
    readonly installerNotes?: string | null;
  }

  export type ScheduleResponse = ApiSuccessResponse<{
    readonly order: OrderWithRelations;
  }>;
}

/**
 * Suppliers API contracts
 */
export namespace SuppliersAPI {
  // GET /api/suppliers
  export interface ListQuery extends BaseQueryParams {
    readonly q?: string;
    readonly isActive?: boolean;
  }

  export type ListResponse = ApiSuccessResponse<
    PaginatedResponse<SupplierContract>
  >;

  // POST /api/suppliers
  export interface CreateRequest {
    readonly name: string;
    readonly taxId?: string;
    readonly email?: string;
    readonly phone?: string;
    readonly address?: string;
    readonly contactPerson?: string;
    readonly website?: string;
    readonly notes?: string;
  }

  export type CreateResponse = ApiSuccessResponse<SupplierContract>;

  // PUT /api/suppliers/[id]
  export type UpdateParams = RouteParams<'/api/suppliers/[id]'>;
  export interface UpdateRequest extends Partial<CreateRequest> {}
  export type UpdateResponse = ApiSuccessResponse<SupplierContract>;
}

/**
 * SKUs API contracts
 */
export namespace SkusAPI {
  // GET /api/skus
  export interface ListQuery extends BaseQueryParams {
    readonly q?: string;
    readonly category?: string;
    readonly supplierId?: SupplierId;
  }

  export type ListResponse = ApiSuccessResponse<
    PaginatedResponse<SkuContract>
  >;

  // POST /api/skus
  export interface CreateRequest {
    readonly code: string;
    readonly name: string;
    readonly description?: string;
    readonly category?: string;
    readonly price?: number;
    readonly supplierId?: SupplierId;
  }

  export type CreateResponse = ApiSuccessResponse<SkuContract>;
}

/**
 * Auth API contracts
 */
export namespace AuthAPI {
  // GET /api/auth/me
  export type MeResponse = ApiSuccessResponse<UserContract>;
}

/**
 * Users API contracts
 */
export namespace UsersAPI {
  // POST /api/users
  export interface CreateRequest {
    readonly email: string;
    readonly name?: string;
    readonly role: UserRole;
  }

  export type CreateResponse = ApiSuccessResponse<UserContract>;

  // PATCH /api/users/[id]/role
  export type UpdateRoleParams = RouteParams<'/api/users/[id]/role'>;
  
  export interface UpdateRoleRequest {
    readonly role: UserRole;
  }
  
  export type UpdateRoleResponse = ApiSuccessResponse<UserContract>;
}

/**
 * Reports API contracts
 */
export namespace ReportsAPI {
  export interface ReportFilter {
    readonly dateFrom?: string;
    readonly dateTo?: string;
    readonly status?: readonly OrderStatus[];
    readonly supplierId?: SupplierId;
    readonly city?: string;
    readonly userId?: UserId;
    readonly clientId?: ClientId;
  }

  // Dashboard reports
  export interface DashboardStats {
    readonly totalOrders: number;
    readonly pendingOrders: number;
    readonly completedOrders: number;
    readonly installationsPending: number;
    readonly totalRevenue: number;
    readonly avgOrderValue: number;
    readonly statusBreakdown: readonly {
      readonly status: OrderStatus;
      readonly count: number;
      readonly totalAmount?: number;
    }[];
    readonly recentOrders: readonly OrderContract[];
    readonly upcomingInstallations: readonly OrderContract[];
  }

  export type DashboardResponse = ApiSuccessResponse<DashboardStats>;

  // History report
  export interface HistoryReportItem {
    readonly date: string;
    readonly newOrders: number;
    readonly completedOrders: number;
    readonly revenue: number;
    readonly statusCounts: Record<OrderStatus, number>;
  }

  export type HistoryReportResponse = ApiSuccessResponse<
    readonly HistoryReportItem[]
  >;

  // Purchase report
  export interface PurchaseReportItem {
    readonly supplierId: SupplierId;
    readonly supplierName: string;
    readonly productId: SkuId;
    readonly skuCode: string;
    readonly skuName: string;
    readonly totalQty: number;
    readonly receivedQty: number;
    readonly pendingQty: number;
    readonly orderIds: readonly OrderId[];
    readonly orderNumbers: readonly number[];
    readonly estimatedValue: number;
  }

  export type PurchaseReportResponse = ApiSuccessResponse<
    readonly PurchaseReportItem[]
  >;
}

// ==================== VALIDATION TYPES ====================

/**
 * Zod schema type inference helper
 */
export type InferZodSchema<T extends z.ZodType> = z.infer<T>;

/**
 * Create a validated API endpoint type
 */
export interface ValidatedEndpoint<
  TMethod extends HttpMethod,
  TPath extends string,
  TQuery = unknown,
  TBody = unknown,
  TResponse = unknown
> {
  readonly method: TMethod;
  readonly path: TPath;
  readonly query?: TQuery;
  readonly body?: TBody;
  readonly response: TResponse;
  readonly params: RouteParams<TPath>;
}

/**
 * API endpoint registry for type-safe client generation
 */
export interface ApiEndpointRegistry {
  // Orders
  readonly 'GET /api/orders': ValidatedEndpoint<
    'GET',
    '/api/orders',
    OrdersAPI.ListQuery,
    never,
    OrdersAPI.ListResponse
  >;
  
  readonly 'POST /api/orders': ValidatedEndpoint<
    'POST',
    '/api/orders',
    never,
    OrdersAPI.CreateRequest,
    OrdersAPI.CreateResponse
  >;
  
  readonly 'GET /api/orders/[id]': ValidatedEndpoint<
    'GET',
    '/api/orders/[id]',
    never,
    never,
    OrdersAPI.GetByIdResponse
  >;
  
  readonly 'PATCH /api/orders/[id]/status': ValidatedEndpoint<
    'PATCH',
    '/api/orders/[id]/status',
    never,
    OrdersAPI.UpdateStatusRequest,
    OrdersAPI.UpdateStatusResponse
  >;

  readonly 'PATCH /api/orders/[id]/schedule': ValidatedEndpoint<
    'PATCH',
    '/api/orders/[id]/schedule',
    never,
    OrdersAPI.ScheduleRequest,
    OrdersAPI.ScheduleResponse
  >;

  readonly 'DELETE /api/orders/[id]/schedule': ValidatedEndpoint<
    'DELETE',
    '/api/orders/[id]/schedule',
    never,
    never,
    OrdersAPI.ScheduleResponse
  >;
  
  // Suppliers
  readonly 'GET /api/suppliers': ValidatedEndpoint<
    'GET',
    '/api/suppliers',
    SuppliersAPI.ListQuery,
    never,
    SuppliersAPI.ListResponse
  >;
  
  readonly 'POST /api/suppliers': ValidatedEndpoint<
    'POST',
    '/api/suppliers',
    never,
    SuppliersAPI.CreateRequest,
    SuppliersAPI.CreateResponse
  >;
  
  // SKUs
  readonly 'GET /api/skus': ValidatedEndpoint<
    'GET',
    '/api/skus',
    SkusAPI.ListQuery,
    never,
    SkusAPI.ListResponse
  >;
  
  readonly 'POST /api/skus': ValidatedEndpoint<
    'POST',
    '/api/skus',
    never,
    SkusAPI.CreateRequest,
    SkusAPI.CreateResponse
  >;
  
  // Auth
  readonly 'GET /api/auth/me': ValidatedEndpoint<
    'GET',
    '/api/auth/me',
    never,
    never,
    AuthAPI.MeResponse
  >;
  
  // Reports
  readonly 'GET /api/reports/dashboard': ValidatedEndpoint<
    'GET',
    '/api/reports/dashboard',
    never,
    never,
    ReportsAPI.DashboardResponse
  >;
}

// ==================== CLIENT HELPER TYPES ====================

/**
 * Extract endpoint by key from registry
 */
export type EndpointByKey<K extends keyof ApiEndpointRegistry> = ApiEndpointRegistry[K];

/**
 * Extract query type from endpoint
 */
export type QueryOf<T> = T extends ValidatedEndpoint<any, any, infer Q, any, any> ? Q : never;

/**
 * Extract body type from endpoint
 */
export type BodyOf<T> = T extends ValidatedEndpoint<any, any, any, infer B, any> ? B : never;

/**
 * Extract response type from endpoint
 */
export type ResponseOf<T> = T extends ValidatedEndpoint<any, any, any, any, infer R> ? R : never;

/**
 * Extract params type from endpoint
 */
export type ParamsOf<T> = T extends ValidatedEndpoint<any, any, any, any, any> 
  ? T['params'] 
  : never;
