import type { OrderDTO } from '@/domain/orders';
import { OrderStatus, Product as PrismaProduct } from '@prisma/client';

export type { OrderStatus };

/**
 * Order with relations included (alias for OrderDTO)
 */
export type OrderWithRelations = OrderDTO;

/**
 * Paginated response for orders
 */
export interface OrdersListResponse {
  data: OrderWithRelations[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

/**
 * Order filter parameters for API
 */
export interface OrderFilterParams {
  customerId?: string;
  status?: OrderStatus | OrderStatus[];
  city?: string;
  assignedUserId?: string;
  userId?: string;
  clientId?: string;
  page?: number;
  limit?: number;
  search?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  scheduledAt?: string;
  /** Inclusive start date (YYYY-MM-DD) for scheduledAt range */
  scheduledAtFrom?: string;
  /** Inclusive end date (YYYY-MM-DD) for scheduledAt range */
  scheduledAtTo?: string;
  /**
   * When true with `scheduledAt` (single day): include orders with null scheduledAt
   * whose status is ready-for-field (READY, READY_FOR_INSTALL, etc.).
   */
  includeUnscheduledReady?: boolean;
  sort?:
    | 'createdAt'
    | 'updatedAt'
    | 'scheduledAt'
    | 'number'
    | 'customerName'
    | 'totalAmount'
    | 'status';
  dir?: 'asc' | 'desc';
  includeDeleted?: boolean;
  includeDemo?: boolean;
  includeItems?: boolean;
  demo?: boolean;
  cursor?: string;
}

/**
 * Input for creating a new order
 */
export interface CreateOrderRequest {
  customerId: string;
  billingAddressId?: string;
  shippingAddressId?: string;
  items: Array<{
    productId: string;
    qty: number;
  }>;
  notes?: string;
  notesInternal?: string;
  createdByUserId?: string;
  /** Optional client telemetry; same shape as OrderCreateSchema.clientInstrumentation */
  clientInstrumentation?: { orderWizardDurationMs?: number };
}

/**
 * Customer with key relations
 */
export interface CustomerWithRelations {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  creditLimitCents?: number;
  paymentTermsDays?: number;
  currentBalanceCents?: number;
  orders?: OrderWithRelations[];
  addresses?: Array<{ id: string; type: 'BILLING' | 'SHIPPING'; city: string; street: string; number: string; floor?: string | null; notes?: string | null }>;
}

/**
 * Customer filter parameters
 */
export interface CustomerFilterParams {
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * API Product representation
 */
export interface Product extends PrismaProduct {
  supplier?: { id: string; name: string };
  stockUnits?: number;
  ordersCount?: number;
  priceCents?: number;
}

/**
 * Paginated response for products
 */
export interface ProductsListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Product filter parameters
 */
export interface ProductFilterParams {
  search?: string;
  category?: string;
  supplierId?: string;
  page?: number;
  limit?: number;
}

/**
 * Standard API Response Wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    [key: string]: any;
  };
  metadata?: Record<string, any>;
}

/**
 * Standard pagination metadata used by list endpoints
 */
export interface PaginationMeta {
  total?: number;
  page?: number;
  totalPages?: number;
  limit?: number;
  perPage?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}
