import { z } from 'zod';
import { ORDER_STATUS_FLOW, normalizeOrderStatus } from '@/lib/orderStatus';

// ===== COMMON SCHEMAS =====

// Basic ID parameter validation
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

// Pagination schema
export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(1000).default(50),
  offset: z.coerce.number().min(0).default(0),
  cursor: z.string().optional(),
});

// Date range schema
export const dateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Sort schema
export const sortSchema = z.object({
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ===== ORDER SCHEMAS =====

// Order status enums (canonical Prisma statuses)
// Input schema that accepts legacy/spec labels and normalizes to canonical enum
export const orderStatusInputSchema = z
  .string()
  .transform((val) => normalizeOrderStatus(val))
  .refine((val) => ORDER_STATUS_FLOW.includes(val), { message: 'Invalid order status' });

// Backward-compatible export name used around the codebase
export const orderStatusEnum = orderStatusInputSchema;

// Business status groups for reporting and filtering
export const businessStatusEnum = z.enum([
  'TO_DO',
  'CALL_BACK',
  'PO_CREATED',
  'AWAITING_STOCK',
  'READY_FOR_INSTALL',
  'SCHEDULED',
  'COMPLETED',
  'SUPPLIED',
  'CANCELLED',
]);

// Address schema
export const addressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  zipCode: z.string().optional(),
  country: z.string().default('Israel'),
  state: z.string().optional(),
});

// Order item schema
export const orderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  name: z.string().min(1, 'Product name is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be non-negative'),
  total: z.number().optional(),
});

// Order creation schema
export const orderCreateSchema = z.object({
  // Customer info
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  customerPhone: z.string().min(1, 'Phone number is required'),
  
  // Addresses
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  
  // Items
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  
  // Order details
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).default('pending'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  notes: z.string().optional(),
  expectedDelivery: z.string().datetime().optional(),
});

// Order update schema
export const orderUpdateSchema = z.object({
  notes: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  expectedDelivery: z.string().datetime().optional(),
});

// Priority enum and update schema for Orders (DB-level priority)
export const orderPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const orderPriorityUpdateSchema = z.object({
  priority: orderPriorityEnum,
});

// Orders list query schema
export const ordersListQuerySchema = z.object({
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
  ...sortSchema.shape,
  
  // Filters
  status: z.string().optional(), // Business status filter
  city: z.string().optional(),
  assignee: z.string().optional(),
  q: z.string().optional(), // Search query
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  
  // Special modes
  map: z.coerce.boolean().default(false), // Return GeoJSON format
});

// Orders map query schema  
export const ordersMapQuerySchema = z.object({
  ...dateRangeSchema.shape,
  status: z.string().optional(),
  city: z.string().optional(),
  bounds: z.object({
    north: z.number(),
    south: z.number(), 
    east: z.number(),
    west: z.number(),
  }).optional(),
});

// Bulk actions schema
export const ordersBulkActionSchema = z.object({
  orderIds: z.array(z.string()).min(1, 'At least one order ID required'),
  action: z.enum(['updateStatus', 'schedule', 'export', 'delete']),
  data: z.object({
    status: z.string().optional(),
    scheduledDate: z.string().datetime().optional(),
    installerId: z.string().optional(),
    format: z.enum(['csv', 'pdf', 'excel']).optional(),
    notes: z.string().optional(),
    notifyCustomers: z.boolean().optional(),
    propagateToWoo: z.boolean().optional(),
  }).optional(),
});

// ===== INSTALLATION SCHEMAS =====

export const installationStatusEnum = z.enum([
  'PENDING',
  'SCHEDULED', 
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
]);

// Schedule creation schema
export const scheduleCreateSchema = z.object({
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime().optional(),
  installerId: z.string().optional(),
  notes: z.string().optional(),
  estimatedDuration: z.number().min(30).max(480).default(120), // 30 min to 8 hours
});

// Installation update schema
export const installationUpdateSchema = z.object({
  status: installationStatusEnum.optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  actualStart: z.string().datetime().optional(),
  actualEnd: z.string().datetime().optional(),
  installerId: z.string().optional(),
  completionNotes: z.string().optional(),
  completionPhotos: z.array(z.string()).optional(),
  customerSignature: z.string().optional(),
  materialsUsed: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string().optional(),
  })).optional(),
});

// ===== SUPPLIER SCHEMAS =====

// Supplier creation schema
export const supplierCreateSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  notes: z.string().optional(),
  contactJson: z.record(z.any()).optional(),
});

// Supplier update schema
export const supplierUpdateSchema = supplierCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Supplier list query schema
export const supplierListQuerySchema = z.object({
  ...paginationSchema.shape,
  ...sortSchema.shape,
  q: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

// ===== SKU SCHEMAS =====

// SKU creation schema
export const skuCreateSchema = z.object({
  code: z.string().min(1, 'SKU code is required'),
  name: z.string().min(1, 'SKU name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative').optional(),
  cost: z.number().min(0, 'Cost must be non-negative').optional(),
  stock: z.number().min(0, 'Stock must be non-negative').default(0),
  reorderLevel: z.number().min(0, 'Reorder level must be non-negative').default(0),
  unit: z.string().optional(),
  attributesJson: z.record(z.any()).optional(),
  supplierId: z.string().min(1, 'Supplier ID is required'),
});

// SKU update schema
export const skuUpdateSchema = skuCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// SKU list query schema
export const skuListQuerySchema = z.object({
  ...paginationSchema.shape,
  ...sortSchema.shape,
  q: z.string().optional(),
  supplierId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  lowStock: z.coerce.boolean().optional(),
});

// ===== PURCHASE ORDER SCHEMAS =====

export const purchaseOrderStatusEnum = z.enum([
  'OPEN',
  'PARTIAL', 
  'COMPLETE',
  'CANCELLED'
]);

// Purchase order creation schema  
export const purchaseOrderCreateSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  notes: z.string().optional(),
  expectedDelivery: z.string().datetime().optional(),
  items: z.array(z.object({
    productId: z.string().min(1, 'SKU ID is required'),
    quantityOrdered: z.number().min(1, 'Quantity must be at least 1'),
    unitPrice: z.number().min(0, 'Unit price must be non-negative').optional(),
    notes: z.string().optional(),
  })).min(1, 'At least one item is required'),
});

// Purchase order update schema
export const purchaseOrderUpdateSchema = z.object({
  status: purchaseOrderStatusEnum.optional(),
  notes: z.string().optional(),
  expectedDelivery: z.string().datetime().optional(),
  actualDelivery: z.string().datetime().optional(),
  items: z.array(z.object({
    id: z.string(),
    quantityReceived: z.number().min(0, 'Quantity received must be non-negative'),
    isFullyReceived: z.boolean().optional(),
    notes: z.string().optional(),
  })).optional(),
});

// Purchase order list query schema
export const purchaseOrderListQuerySchema = z.object({
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
  ...sortSchema.shape,
  supplierId: z.string().optional(),
  status: purchaseOrderStatusEnum.optional(),
});

// ===== USER SCHEMAS =====

export const userRoleEnum = z.enum([
  'ADMIN',
  'OPERATIONS',
]);

// User creation schema
export const userCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  roleId: z.string().min(1, 'Role ID is required'),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
});

// User update schema
export const userUpdateSchema = userCreateSchema.partial();

// User list query schema
export const userListQuerySchema = z.object({
  ...paginationSchema.shape,
  ...sortSchema.shape,
  q: z.string().optional(),
  roleId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

// ===== REPORT SCHEMAS =====

// Status report query schema
export const statusReportQuerySchema = z.object({
  ...dateRangeSchema.shape,
  statuses: z.string().optional(), // Comma-separated
  city: z.string().optional(),
  groupBy: z.enum(['status', 'city', 'date']).default('status'),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
  includeEmpty: z.coerce.boolean().default(false),
});

// Waiting stock report query schema
export const waitingStockQuerySchema = z.object({
  ...dateRangeSchema.shape,
  supplierId: z.string().optional(),
  productId: z.string().optional(),
  city: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
});

// Waiting installation report query schema
export const waitingInstallationQuerySchema = z.object({
  ...dateRangeSchema.shape,
  city: z.string().optional(),
  installer: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: installationStatusEnum.optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['scheduledDate', 'createdDate', 'city', 'priority']).default('scheduledDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  includeOverdue: z.coerce.boolean().default(true),
});

// History report query schema
export const historyReportQuerySchema = z.object({
  ...dateRangeSchema.shape,
  groupBy: z.enum(['day', 'week', 'month']).default('month'),
  includeDetails: z.coerce.boolean().default(false),
  limit: z.coerce.number().min(1).max(1000).default(12),
});

// ===== CALENDAR SCHEMAS =====

export const calendarEventStatusEnum = z.enum([
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED'
]);

// Calendar query schema
export const calendarQuerySchema = z.object({
  ...dateRangeSchema.shape,
  installerId: z.string().optional(),
  status: calendarEventStatusEnum.optional(),
  view: z.enum(['day', 'week', 'month']).default('month'),
});

// ===== NOTIFICATION SCHEMAS =====

export const notificationMethodEnum = z.enum([
  'SMS',
  'WHATSAPP', 
  'EMAIL',
  'DISABLED'
]);

export const notificationTypeEnum = z.enum([
  'APPOINTMENT_CONFIRMATION',
  'APPOINTMENT_REMINDER_1HOUR',
  'APPOINTMENT_REMINDER_1DAY', 
  'APPOINTMENT_REMINDER_1WEEK',
  'APPOINTMENT_DELAY',
  'APPOINTMENT_RESCHEDULED',
  'ORDER_STATUS_CHANGE',
  'INSTALLATION_COMPLETE',
  'CUSTOM'
]);

// Reminder request schema
export const reminderRequestSchema = z.object({
  type: notificationTypeEnum,
  channel: notificationMethodEnum,
  scheduledFor: z.string().datetime().optional(), // If not provided, send immediately
  recipient: z.string().optional(), // If not provided, use order customer
  customMessage: z.string().optional(),
});

// ===== INTEGRATION SCHEMAS =====

// WooCommerce sync request schema
export const manualSyncRequestSchema = z.object({
  type: z.enum(['orders', 'customers', 'products', 'all']).default('orders'),
  fullSync: z.boolean().default(false),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Integration settings schema
export const integrationSettingsSchema = z.object({
  woocommerce: z.object({
    baseUrl: z.string().url('Invalid WooCommerce URL').optional(),
    consumerKey: z.string().optional(),
    consumerSecret: z.string().optional(),
    webhookSecret: z.string().optional(),
    enabled: z.boolean().default(false),
  }).optional(),
  
  googleCalendar: z.object({
    serviceAccountEmail: z.string().email('Invalid service account email').optional(),
    privateKey: z.string().optional(),
    calendarId: z.string().optional(),
    enabled: z.boolean().default(false),
  }).optional(),
  
  messaging: z.object({
    provider: z.enum(['twilio', 'meta']).optional(),
    accountSid: z.string().optional(),
    authToken: z.string().optional(),
    fromPhone: z.string().optional(),
    enabled: z.boolean().default(false),
  }).optional(),
  
  maps: z.object({
    mapboxToken: z.string().optional(),
    enabled: z.boolean().default(false),
  }).optional(),
});

// ===== RESPONSE SCHEMAS =====

// Standard API response
export const apiResponseSchema = <T>(dataSchema: z.ZodSchema<T>) => z.object({
  ok: z.boolean(),
  data: dataSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
});

// Paginated response
export const paginatedResponseSchema = <T>(itemSchema: z.ZodSchema<T>) => z.object({
  items: z.array(itemSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(), 
    offset: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
  }),
});

// Export type helpers
export type OrderCreateRequest = z.infer<typeof orderCreateSchema>;
export type OrderUpdateRequest = z.infer<typeof orderUpdateSchema>;
export type OrdersListQuery = z.infer<typeof ordersListQuerySchema>;
export type OrdersBulkActionRequest = z.infer<typeof ordersBulkActionSchema>;

export type SupplierCreateRequest = z.infer<typeof supplierCreateSchema>;
export type SupplierUpdateRequest = z.infer<typeof supplierUpdateSchema>;

export type SKUCreateRequest = z.infer<typeof skuCreateSchema>;
export type SKUUpdateRequest = z.infer<typeof skuUpdateSchema>;

export type PurchaseOrderCreateRequest = z.infer<typeof purchaseOrderCreateSchema>;
export type PurchaseOrderUpdateRequest = z.infer<typeof purchaseOrderUpdateSchema>;

export type UserCreateRequest = z.infer<typeof userCreateSchema>;
export type UserUpdateRequest = z.infer<typeof userUpdateSchema>;

export type ScheduleCreateRequest = z.infer<typeof scheduleCreateSchema>;
export type InstallationUpdateRequest = z.infer<typeof installationUpdateSchema>;

export type ReminderRequest = z.infer<typeof reminderRequestSchema>;
export type ManualSyncRequest = z.infer<typeof manualSyncRequestSchema>;

// Validation helper function
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: z.ZodIssue[];
} {
  const result = schema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    errors: result.success ? undefined : result.error.issues,
  };
}

// ===== ORDER NOTES SCHEMAS =====
// Note: Keep content length small to prevent abuse and match UI limits
export const orderNoteCreateSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Note content is required')
    .max(1000, 'Note content must be less than 1000 characters'),
});

export type OrderNoteCreateRequest = z.infer<typeof orderNoteCreateSchema>;

// ===== PAYMENT SCHEMAS =====

// Payment method enum
export const paymentMethodEnum = z.enum([
  'CASH',
  'CHECK',
  'BANK_TRANSFER',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'BIT',
  'PAYPAL',
  'STRIPE',
  'OTHER',
]);

// Payment status enum (already defined in DB, redefining for validation)
export const paymentStatusEnum = z.enum([
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'PARTIAL',
  'FAILED',
  'REFUNDED',
]);

// Payment creation schema
export const paymentCreateSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  method: paymentMethodEnum,
  amountCents: z.number().int().min(0, 'Amount must be non-negative'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('ILS'),

  // Optional fields
  paymentDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),

  // Method-specific fields
  creditCardLast4: z.string().length(4).optional(),
  checkNumber: z.string().max(50).optional(),
  bankTransactionId: z.string().max(100).optional(),
  paymentProvider: z.string().max(50).optional(),

  // External references
  externalId: z.string().optional(),
  receiptUrl: z.string().url().max(500).optional(),

  // Processing
  processedBy: z.string().uuid().optional(),
  approvedBy: z.string().uuid().optional(),

  // Exchange rate for non-default currency
  exchangeRate: z.number().positive().optional(),

  // Metadata
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) => {
    // If credit card, require last 4 digits
    if (data.method === 'CREDIT_CARD' && !data.creditCardLast4) {
      return false;
    }
    // If check, require check number
    if (data.method === 'CHECK' && !data.checkNumber) {
      return false;
    }
    return true;
  },
  {
    message: 'Missing required fields for payment method',
  }
);

// Payment update schema
export const paymentUpdateSchema = z.object({
  status: paymentStatusEnum.optional(),
  notes: z.string().max(5000).optional(),
  receiptUrl: z.string().url().max(500).optional(),
  approvedBy: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

// Payment refund schema
export const paymentRefundSchema = z.object({
  amountCents: z.number().int().min(1, 'Refund amount must be positive'),
  reason: z.string().min(1, 'Refund reason is required').max(500),
  notes: z.string().max(1000).optional(),
  processedBy: z.string().uuid().optional(),
});

// Payment list query schema
export const paymentsListQuerySchema = z.object({
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
  ...sortSchema.shape,

  // Filters
  orderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  method: paymentMethodEnum.optional(),
  status: paymentStatusEnum.optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
});

// ===== PAYMENT PLAN SCHEMAS =====

// Payment plan status enum
export const paymentPlanStatusEnum = z.enum([
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'DEFAULTED',
]);

// Installment status enum
export const installmentStatusEnum = z.enum([
  'PENDING',
  'PAID',
  'OVERDUE',
  'CANCELLED',
]);

// Payment plan creation schema
export const paymentPlanCreateSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  totalAmountCents: z.number().int().min(1, 'Total amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('ILS'),
  numberOfInstallments: z.number().int().min(2, 'Must have at least 2 installments').max(24, 'Maximum 24 installments'),
  frequencyDays: z.number().int().min(1, 'Frequency must be at least 1 day').default(30),
  startDate: z.string().datetime(),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

// Payment plan update schema
export const paymentPlanUpdateSchema = z.object({
  status: paymentPlanStatusEnum.optional(),
  endDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

// Record installment payment schema
export const recordInstallmentPaymentSchema = z.object({
  paidAmountCents: z.number().int().min(1, 'Payment amount must be positive'),
  paidDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),

  // Payment details (will create a Payment record)
  method: paymentMethodEnum,
  reference: z.string().max(100).optional(),
  creditCardLast4: z.string().length(4).optional(),
  checkNumber: z.string().max(50).optional(),
  bankTransactionId: z.string().max(100).optional(),
  paymentProvider: z.string().max(50).optional(),
  receiptUrl: z.string().url().max(500).optional(),
  processedBy: z.string().uuid().optional(),
});

// ===== TYPE EXPORTS =====

export type PaymentCreateRequest = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdateRequest = z.infer<typeof paymentUpdateSchema>;
export type PaymentRefundRequest = z.infer<typeof paymentRefundSchema>;
export type PaymentsListQuery = z.infer<typeof paymentsListQuerySchema>;
export type PaymentPlanCreateRequest = z.infer<typeof paymentPlanCreateSchema>;
export type PaymentPlanUpdateRequest = z.infer<typeof paymentPlanUpdateSchema>;
export type RecordInstallmentPaymentRequest = z.infer<typeof recordInstallmentPaymentSchema>;
