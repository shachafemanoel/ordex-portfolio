// Domain Types for Ordex Order Management System
// Import OrderStatus from Prisma client (generated from schema)
import type { AppointmentDTO } from '@/domain/calendar/appointmentDTO';
import type { OrderDTO, OrderItemDTO, OrderPaymentDTO } from '@/domain/orders/orderDTO';
import type { ProductDTO } from '@/domain/products/productDTO';
import type { RoleDTO } from '@/domain/roles/normalizeRole';
import type { SupplierDTO } from '@/domain/suppliers/supplierDTO';
import type { UserDTO as CanonicalUser } from '@/domain/users/normalizeUser';
import type {
  AddressValidationStatus,
  CustomerLedgerEntryType,
  FulfillmentType,
  OrderStatus,
  PaymentStatus,
  ScheduleMode,
} from '@prisma/client';
import type { PurchaseOrderStatus as PurchaseOrderWorkflowStatus } from '@/lib/purchaseOrderStatus';

// Import order status utilities
import { ORDER_STATUS, ORDER_STATUS_COLORS, ORDER_STATUS_TRANSITIONS } from '@/lib/orderStatus';

// Re-export OrderStatus and related utilities for backward compatibility
export type { FulfillmentType, OrderStatus, PaymentStatus, ScheduleMode };
export const allowedTransitions = ORDER_STATUS_TRANSITIONS;
export const statusLabels = ORDER_STATUS;
export const statusColors = ORDER_STATUS_COLORS;

export type PlanStatus = 'DRAFT' | 'OPTIMIZED' | 'APPLIED';

// Plan Interfaces
export interface InstallationPlanItem {
  id: string;
  planId: string;
  orderId: string;
  seq: number;
  type: FulfillmentType;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  durationMinutes: number;
  notes?: string | null;
  order?: Order;
}

export interface InstallationPlan {
  id: string;
  date: Date | string;
  status: PlanStatus;
  routeSummary?: string | null;
  totalStops: number;
  totalDuration: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  items?: InstallationPlanItem[];
}

// User Role Enum for RBAC
export type UserRole = 'ADMIN' | 'SALES' | 'PURCHASING' | 'INSTALLER' | 'OPERATIONS' | 'VIEWER';

// Order Priority
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

// Purchase Order Status
export type PurchaseOrderStatus = PurchaseOrderWorkflowStatus;

/**
 * ========================================================================
 * CANONICAL API ENVELOPE TYPES
 * ========================================================================
 * All API responses MUST use these envelope types for consistency
 */

/**
 * Standard API Response Envelope for Single Resources
 * Used for: GET /api/orders/:id, POST /api/orders, etc.
 */
export interface ApiResponseEnvelope<T> {
  /** The response data */
  data: T;
}

/**
 * Pagination Metadata
 */
export interface PaginationMeta {
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  perPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext?: boolean;
  /** Whether there is a previous page */
  hasPrev?: boolean;
}

/**
 * Paginated API Response Envelope for Collections
 * Used for: GET /api/orders, GET /api/customers, etc.
 */
export interface PaginatedResponseEnvelope<T> {
  /** Array of items for current page */
  data: T[];
  /** Pagination metadata */
  pagination: PaginationMeta;
}

// Enhanced API Response types
export interface DashboardData {
  status: OrderStatus;
  count: number;
  totalAmount?: number;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
}

export interface DashboardSummary {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  installationsPending: number;
  totalRevenue: number;
  avgOrderValue: number;
  statusBreakdown: DashboardData[];
  recentOrders: Order[];
  upcomingInstallations: Order[];
  lowStockAlerts?: {
    productId: string;
    skuName: string;
    pendingQty: number;
    receivedQty: number;
  }[];
}

// Report Types
export interface ReportFilter {
  dateFrom?: Date | string;
  dateTo?: Date | string;
  status?: OrderStatus[];
  supplierId?: string;
  city?: string;
  userId?: string;
  clientId?: string;
}

export interface HistoryReportItem {
  date: string;
  newOrders: number;
  completedOrders: number;
  revenue: number;
  statusCounts: Record<OrderStatus, number>;
}

export interface WaitingGoodsReportItem {
  orderId: string;
  orderNumber: number;
  customerName: string;
  skuCode: string;
  skuName: string;
  qtyOrdered: number;
  qtyReceived: number;
  qtyPending: number;
  supplierName: string;
  daysWaiting: number;
  poDate?: Date | string;
}

export interface WaitingInstallReportItem {
  orderId: string;
  orderNumber: number;
  customerName: string;
  address: string;
  city: string;
  scheduledDate?: Date | string;
  daysWaiting: number;
  installerName?: string;
  contactPhone?: string;
}

export interface PurchaseReportItem {
  supplierId: string;
  supplierName: string;
  productId: string;
  skuCode: string;
  skuName: string;
  totalQty: number;
  receivedQty: number;
  pendingQty: number;
  orderIds: string[];
  orderNumbers: number[];
  estimatedValue: number;
}

// Error Types
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, any>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
  meta?: Record<string, any>;
  raw?: unknown;
}

// Pagination Types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Map Types
export interface MapOrder {
  id: string;
  number: string;
  customerName: string;
  address: string;
  city?: string;
  status: OrderStatus;
  lat?: number;
  lng?: number;
  latitude?: number | null;
  longitude?: number | null;
  addressValidationStatus?: AddressValidationStatus | null;
  addressValidationReason?: string | null;
  installAt?: Date | string;
  totalAmount: number;
}

// Utility Types
export type DateRange = {
  from: Date | string;
  to: Date | string;
};

export type SortDirection = 'asc' | 'desc';

export type SortField =
  | 'createdAt'
  | 'updatedAt'
  | 'number'
  | 'customerName'
  | 'totalAmount'
  | 'status';

// Form Types
export type OrderFormData = import('@/lib/validation').OrderFormData;

export interface SupplierFormData {
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  website?: string;
  notes?: string;
}

export interface ClientFormData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxId?: string;
  contactPerson?: string;
  notes?: string;
  creditLimitCents?: number | null;
  paymentTermsDays?: number | null;
  accountNotes?: string | null;
}

// Health Check Types
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  checks?: {
    database?: {
      status: string;
      responseTime: number;
    };
    redis?: {
      status: string;
      responseTime: number;
    };
    external?: {
      googleCalendar?: {
        status: string;
        responseTime: number;
      };
      twilio?: {
        status: string;
        responseTime: number;
      };
    };
  };
}

export type OrderItem = OrderItemDTO & {
  quantity?: number;
  skuName?: string;
};

export type OrderPayment = OrderPaymentDTO;

export type Order = OrderDTO & {
  installationDate?: Date | string;
  installationAddress?: string;
  user?: User;
  client?: Client;
  purchaseLinks?: PurchaseOrderLink[];
  latitude?: number | null;
  longitude?: number | null;
  addressValidationStatus?: AddressValidationStatus | null;
  addressValidationReason?: string | null;
  addressRaw?: string | null;
  normalizedAddress?: {
    city?: string | null;
    street?: string | null;
    houseNumber?: string | null;
    floor?: string | null;
    apartment?: string | null;
  } | null;
  fulfillmentType?: FulfillmentType;
  scheduleMode?: ScheduleMode | null;
  scheduledEnd?: Date | string | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  durationOverrideMinutes?: number | null;
  completedAt?: Date | string | null;
};

export interface StatusChangePayload {
  reason?: string;
  installAt?: Date | string;
  installerName?: string | null;
  installerNotes?: string | null;
}

export interface InstallationSchedulePayload {
  scheduledAt: Date | string;
  scheduledEnd?: Date | string | null;
  fulfillmentType?: FulfillmentType;
  scheduleMode?: ScheduleMode | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  notesToCrew?: string | null;
  status?: string | null;
  durationMinutes?: number | null;
  installerName?: string | null;
  installerNotes?: string | null;
  installerId?: string | null;
  address?: {
    city: string;
    street: string;
    number: string;
    floor?: string;
    notes?: string;
    lat?: number;
    lng?: number;
  };
  calendarSync?: boolean;
}

// Purchase Order Types
export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplier?: Supplier;
  status: PurchaseOrderStatus;
  createdAt: Date | string;
  updatedAt?: Date | string;
  links: PurchaseOrderLink[];
}

export interface PurchaseOrderLink {
  id: string;
  poId: string;
  orderId: string;
  order?: Order;
  po?: PurchaseOrder;
}

// Enhanced Status History entry for Audit Trail
export interface StatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  changedBy?: string;
  reason?: string;
  createdAt: Date | string;
  changedByUser?: User;
  order?: Order;
}

// Enhanced Client types
export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxId?: string;
  contactPerson?: string;
  notes?: string;
  orders?: Order[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
  creditLimitCents?: number | null;
  paymentTermsDays?: number | null;
  currentBalanceCents?: number;
  accountNotes?: string | null;
  outstandingOrders?: OutstandingOrderSummary[];
  ledgerEntries?: CustomerLedgerEntryView[];
  accountSummary?: CustomerAccountSummary;
}

export interface OutstandingOrderSummary {
  id: string;
  number: string;
  status: OrderStatus;
  totalCents: number;
  paidAmountCents: number;
  balanceCents: number;
  createdAt: Date | string;
  dueDate?: Date | string | null;
  isOverdue?: boolean;
}

export interface CustomerLedgerEntryView {
  id: string;
  type: CustomerLedgerEntryType;
  deltaCents: number;
  balanceCents: number;
  description?: string | null;
  createdAt: Date | string;
  order?: {
    id?: string;
    number?: string | null;
  } | null;
  payment?: {
    id?: string;
    method?: string | null;
  } | null;
}

export interface CustomerAccountSummary {
  currentBalanceCents: number;
  creditLimitCents?: number | null;
  availableCreditCents?: number | null;
  paymentTermsDays?: number | null;
  overdueOrdersCount: number;
  lastPaymentAt?: Date | string | null;
}

// Enhanced Supplier types
export type Supplier = SupplierDTO & {
  skus?: Sku[];
  purchaseOrders?: PurchaseOrder[];
};

// Enhanced SKU types
export interface Sku {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  supplierId?: string;
  supplier?: Supplier;
  items?: OrderItem[];
  stock?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type Product = ProductDTO;

// Enhanced User types
export type User = CanonicalUser & { role: RoleDTO };

// Calendar Integration Types
export interface CalendarEvent {
  id: string;
  orderId: string;
  title: string;
  description?: string;
  startTime: Date | string;
  endTime: Date | string;
  location?: string;
  attendees?: string[];
  googleEventId?: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  createdAt: Date | string;
  updatedAt: Date | string;
  assignedUser?: User;
  duration?: number;
  order?: Order; // Now includes full Order object
  createdByUser?: User; // Added createdByUser
}

export type Appointment = AppointmentDTO;

// Notification Types
export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'sms' | 'whatsapp' | 'email';
  trigger: 'installation_reminder' | 'status_change' | 'manual';
  template: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface NotificationLog {
  id: string;
  orderId?: string;
  templateId?: string;
  recipient: string;
  type: 'sms' | 'whatsapp' | 'email';
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: Date | string;
  deliveredAt?: Date | string;
  errorMessage?: string;
  createdAt: Date | string;
}
