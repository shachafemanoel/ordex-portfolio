import {
  AddressValidationStatus,
  OrderChannel,
  OrderPriority,
  OrderStatus,
  PaymentStatus,
  PurchaseOrderStatus,
  UserRole,
} from '@prisma/client';

// Supporting DTOs
export interface OrderCustomerSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  creditStatus?: 'GOOD' | 'WARNING' | 'BLOCKED';
}

export interface AddressSummary {
  id: string;
  type: 'BILLING' | 'SHIPPING';
  city: string;
  street: string;
  number: string;
  floor?: string | null;
  apartment?: string | null;
  fullAddress: string; // Computed: formatted address
  coordinates?: { lat: number; lng: number } | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
}

export interface OrderItemDTO {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  quantity: number;
  pricePerUnit: number; // Converted from cents
  total: number; // Computed: quantity * pricePerUnit
  received: boolean;
  receivedQuantity: number;
  allocationStatus?: 'PENDING' | 'ALLOCATED' | 'OUT_OF_STOCK' | 'ON_ORDER';
  supplier?: SupplierSummary | null;
  product?: ProductSummary | null;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// Re-export or define compatible with PaymentDTO
export interface OrderPaymentDTO {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface StatusRequirement {
  id: string;
  label: string;
  isMet: boolean;
  isBlocking: boolean;
  details?: string;
}

export interface SupplierSummary {
  id: string;
  name: string;
  email?: string | null;
}

export interface ProductSummary {
  id: string;
  stock?: number;
}

export interface OrderPurchaseOrderSummary {
  id: string;
  reference: string;
  status: PurchaseOrderStatus;
  supplierName: string | null;
  expectedAt: string | null;
}

export interface OrderCalendarEventDTO {
  id: string;
  orderId: string;
  title: string;
  description?: string;
  startTime: Date | string;
  endTime: Date | string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  type: string;
  location?: string;
}

export interface OrderShipmentDTO {
  id: string;
  status: string;
  deliveredAt?: string | null;
}

export interface OrderStatusHistoryEntryDTO {
  id: string;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  reason?: string | null;
  metadata?: unknown;
  createdAt: string;
  changedByUser?: {
    id: string;
    name: string;
  } | null;
}

export interface OrderNoteEntryDTO {
  id: string;
  content: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
  } | null;
}

import { DerivedTaskInfo } from '@/src/server/dto/ops.dto';

export interface OrderDTO {
  // Core fields
  id: string;
  number: string;
  status: OrderStatus;
  statusUpdatedAt?: string | null;

  // Add derived task info
  derivedTask?: DerivedTaskInfo;

  // Ops Board
  opsStatus?: string | null;
  opsLane?: string | null;
  checklistState?: any; // JSON value

  // V2 Compat
  statusV2?: string;
  isDraft?: boolean;
  onHold?: boolean;
  inventoryStatus?: string;
  completionType?: string | null;

  statusLabel: string;
  statusProgress: number; // Computed: 0-100%
  priority: OrderPriority;
  urgent?: boolean; // Mark order as urgent for expedited handling
  channel: OrderChannel;
  fulfillmentType?: import('@prisma/client').FulfillmentType;

  // Summaries
  itemSummary?: string;
  shippingAddressSummary?: string;

  // Financial (normalized to decimal)
  subTotal: number; // Converted from cents
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  paidAmount: number;
  outstandingBalance: number; // Computed: total - paidAmount
  paymentStatus: PaymentStatus;
  currency: string;

  // Customer (embedded)
  customer: OrderCustomerSummary | null;

  // Compatibility fields (often accessed directly in UI)
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  installerName?: string | null;
  installerNotes?: string | null;
  notesToCrew?: string | null;
  totalAmount?: number; // Alias for total
  note?: string | null; // Alias for notes
  notes?: string | null; // Alias for note (compatibility)

  // Address intelligence
  address?: string | null; // Alias for addressLine or full address
  addressLine?: string | null;
  city?: string | null;
  addressRaw?: string | null;
  addressValidationStatus?: AddressValidationStatus | null;
  addressValidationReason?: string | null;
  normalizedAddress?: {
    city?: string | null;
    street?: string | null;
    houseNumber?: string | null;
    floor?: string | null;
    apartment?: string | null;
  } | null;
  coordinates?: { lat: number; lng: number } | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  street?: string | null;
  houseNumber?: string | null;
  floor?: string | null;
  apartment?: string | null;
  totalCents?: number;
  paidAmountCents?: number;
  sourceStatus?: string | null;
  sourceReviewReason?: string | null;
  addressOverridden?: boolean;
  sourceAddressDiffers?: boolean;

  // Addresses (embedded)
  billingAddress: AddressSummary | null;
  shippingAddress: AddressSummary | null;

  // Items (embedded)
  items: OrderItemDTO[];
  itemsCount: number; // Computed: items.length

  // Labels
  labels?: Array<{ id: string; name: string; color: string; stage?: string | null }>;

  // Payments (embedded, optional)
  payments?: OrderPaymentDTO[];
  paymentsCount?: number;
  statusHistory?: OrderStatusHistoryEntryDTO[];
  noteEntries?: OrderNoteEntryDTO[];

  // Assigned user (embedded)
  assignedUser: UserSummary | null;
  assignedUserId?: string | null;
  deliveryAssignedTo?: UserSummary | null;
  deliveryAssignedToId?: string | null;

  // Timestamps
  createdAt: string; // ISO 8601 format
  updatedAt: string;
  lastPaymentAt?: string | null;
  scheduledAt?: string | null;
  scheduledEnd?: string | null;
  scheduleMode?: import('@prisma/client').ScheduleMode | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  dueDate?: string | null;
  installAt?: string | null;

  // Computed fields
  isOverdue: boolean; // Based on status + time
  daysInCurrentStatus: number;
  nextAllowedStatuses: OrderStatus[];
  requirementChecklist?: StatusRequirement[];
  nextActions: Action[];
  workflowHints?: {
    currentStage: string;
    description: string;
  };
  itemsChecklist?: Record<string, boolean>;
  orderChecklist?: Record<string, boolean>;
}

// Import and re-export PaymentCreateInput
import type { PaymentCreateInput } from '@/domain/payments';
import type { Action } from '@/lib/workflow-requirements';

export type { PaymentCreateInput } from '@/domain/payments';

// Create input
export interface OrderCreateInput {
  customerId: string;
  billingAddressId: string;
  shippingAddressId: string;
  items: OrderItemCreateInput[];
  priority?: OrderPriority;
  notes?: string;
  payment?: PaymentCreateInput;
}

export interface OrderItemCreateInput {
  productId?: string | null;
  sku?: string | null;
  name: string;
  quantity: number;
  pricePerUnit: number; // In dollars (or base currency)
  supplierId?: string;
  remarks?: string;
}

// Update input
export interface OrderUpdateInput {
  priority?: OrderPriority;
  assignedUserId?: string | null;
  deliveryAssignedToId?: string | null;
  notes?: string;
  scheduledAt?: Date | string | null;
  completedAt?: Date | string | null;
  city?: string | null;
  addressLine?: string | null;
  lat?: number | null;
  lng?: number | null;
  installerName?: string | null;
  installerNotes?: string | null;
  subTotal?: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  totalAmount?: number;
  labels?: string[];
  urgent?: boolean;
}

// List filters
export interface OrderListFilters {
  status?: OrderStatus[];
  customerId?: string;
  supplierId?: string;
  assignedUserId?: string;
  deliveryAssignedToId?: string;
  city?: string;
  priority?: OrderPriority[];
  channel?: OrderChannel[];
  paymentStatus?: PaymentStatus[];
  dateFrom?: string;
  dateTo?: string;
  q?: string; // Search query
  hasOverdueItems?: boolean;
  requiresAttention?: boolean;
  includeDeleted?: boolean;
  includeDemo?: boolean;
  demo?: boolean;
}

// Status change input
export interface OrderStatusChangeInput {
  newStatus: OrderStatus;
  reason?: string;
  metadata?: Record<string, any>;
}
