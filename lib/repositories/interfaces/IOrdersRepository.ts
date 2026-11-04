/**
 * Orders Repository Interface
 *
 * Defines the contract for order data access operations.
 * Implementations can be Prisma-based, in-memory, or any other data source.
 *
 * @module lib/repositories/interfaces/IOrdersRepository
 */

import type {
  Order,
  OrderChannel,
  OrderPriority,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';

/**
 * Order filter criteria for queries
 */
export interface OrderFilter {
  customerId?: string;
  status?: OrderStatus | OrderStatus[];
  channel?: OrderChannel;
  priority?: OrderPriority;
  paymentStatus?: PaymentStatus;
  city?: string;
  assignedUserId?: string;
  stage?: string[];
  taskLabel?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string; // Search in customer name, email, phone, order number
}

/**
 * Order with relations included
 */
export interface OrderWithRelations extends Order {
  customer?: any; // To be refined in Phase 4
  items?: any[];
  billingAddress?: any;
  shippingAddress?: any;
  payments?: any[];
  statusHistory?: any[];
  assignedUser?: any;
  tasks?: any[];
}

/**
 * Create order input
 */
export interface CreateOrderInput {
  customerId: string;
  billingAddressId: string;
  shippingAddressId: string;
  channel?: OrderChannel;
  subTotalCents: number;
  taxCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  notes?: string;
  notesInternal?: string;
  priority?: OrderPriority;
  createdByUserId?: string;
  items: CreateOrderItemInput[];
}

/**
 * Create order item input
 */
export interface CreateOrderItemInput {
  productId: string;
  sku: string;
  name: string;
  description?: string;
  qty: number;
  priceCents: number;
  totalCents: number;
  supplierId?: string;
}

/**
 * Update order input
 */
export interface UpdateOrderInput {
  status?: OrderStatus;
  priority?: OrderPriority;
  assignedUserId?: string | null;
  scheduledAt?: Date | string | null;
  completedAt?: Date | string | null;
  installerName?: string | null;
  installerNotes?: string | null;
  notes?: string | null;
  notesInternal?: string | null;
  paymentStatus?: PaymentStatus;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Orders Repository Interface
 */
export interface IOrdersRepository {
  /**
   * Find order by ID
   */
  findById(id: string, includeRelations?: boolean): Promise<OrderWithRelations | null>;

  /**
   * Find order by number
   */
  findByNumber(number: string, includeRelations?: boolean): Promise<OrderWithRelations | null>;

  /**
   * Find orders by filter with pagination
   */
  findMany(
    filter?: OrderFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<OrderWithRelations>>;

  /**
   * Find orders for a customer
   */
  findByCustomer(
    customerId: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<OrderWithRelations>>;

  /**
   * Find orders by status
   */
  findByStatus(
    status: OrderStatus | OrderStatus[],
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<OrderWithRelations>>;

  /**
   * Create a new order
   */
  create(data: CreateOrderInput): Promise<OrderWithRelations>;

  /**
   * Update an existing order
   */
  update(id: string, data: UpdateOrderInput): Promise<OrderWithRelations>;

  /**
   * Delete an order (soft delete)
   */
  delete(id: string): Promise<void>;

  /**
   * Count orders by filter
   */
  count(filter?: OrderFilter): Promise<number>;

  /**
   * Get order statistics
   */
  getSalesStats(period: 'day' | 'week' | 'month' | 'year'): Promise<any>;

  // Workflow & Audit
  logEvent(entry: { orderId: string; userId: string; type: string; payload?: any }): Promise<void>;

  /**
   * Get financial statistics
   */
  getFinancialStats(filter?: OrderFilter): Promise<{
    totalRevenue: number;
    outstanding: number;
    collected: number;
    overdue: number;
  }>;

  /**
   * Check if order exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Execute operation in transaction
   */
  transaction<T>(fn: (repo: IOrdersRepository) => Promise<T>): Promise<T>;
}
