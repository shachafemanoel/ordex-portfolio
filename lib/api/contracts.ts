import { z } from 'zod';
import type { 
  ApiSuccessResponse 
} from '@/types/api-contracts';

// ==================== BASE SCHEMAS ====================

export const PaginationInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export const DateRangeFilterSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const BaseQueryParamsSchema = PaginationInputSchema.partial();

// ==================== DOMAIN SCHEMAS ====================

export const OrderStatusSchema = z.enum([
  'NEW',
  'FOLLOW_UP', 
  'CANCELLED',
  'PO',
  'WAITING_GOODS',
  'PARTIAL',
  'SCHEDULE',
  'WAITING_INSTALL',
  'DONE'
] as const);

export const UserRoleSchema = z.enum([
  'ADMIN',
  'OPERATIONS',
] as const);

export const PurchaseOrderStatusSchema = z.enum([
  'OPEN',
  'PARTIAL',
  'COMPLETE', 
  'CANCELLED'
] as const);

// ==================== RESPONSE SCHEMAS ====================

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  field: z.string().optional(),
  stack: z.string().optional(),
});

export const ApiResponseSchema = <TData extends z.ZodTypeAny>(dataSchema: TData) =>
  z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      data: dataSchema,
      meta: z.record(z.unknown()).optional(),
      timestamp: z.string(),
      requestId: z.string().optional(),
    }),
    z.object({
      success: z.literal(false),
      error: ApiErrorSchema,
      timestamp: z.string(),
      requestId: z.string().optional(),
    }),
  ]);

export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    meta: PaginationMetaSchema,
  });

// ==================== ENTITY SCHEMAS ====================

export const OrderContractSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  totalAmount: z.number().nonnegative(),
  address: z.string().min(1),
  city: z.string().optional(),
  houseNumber: z.string().optional(), 
  floor: z.string().optional(),
  note: z.string().optional(),
  status: OrderStatusSchema,
  installAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userId: z.string().optional(),
  clientId: z.string().optional(),
});

export const OrderItemContractSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string().optional(),
  qty: z.number().int().positive(),
  received: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UserContractSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: UserRoleSchema,
  isActive: z.boolean(),
  lastLoginAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SupplierContractSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  taxId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  website: z.string().url().optional(),
  notes: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SkuContractSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.number().nonnegative().optional(),
  supplierId: z.string().optional(),
  stock: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ==================== API ENDPOINT SCHEMAS ====================

// Orders API
export const OrdersListQuerySchema = BaseQueryParamsSchema.extend({
  status: z.array(OrderStatusSchema).optional(),
  q: z.string().max(200).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  userId: z.string().optional(),
  clientId: z.string().optional(),
  city: z.string().optional(),
});

export const OrdersCreateRequestSchema = z.object({
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  address: z.string().min(5).max(200),
  city: z.string().max(50).optional(),
  houseNumber: z.string().max(10).optional(),
  floor: z.string().max(10).optional(),
  note: z.string().max(500).optional(),
  totalAmount: z.number().positive(),
  items: z.array(z.object({
    productId: z.string().optional(),
    qty: z.number().int().positive(),
  })).min(1),
});

export const OrdersUpdateStatusRequestSchema = z.object({
  status: OrderStatusSchema,
  reason: z.string().max(200).optional(),
  installAt: z.string().datetime().optional(),
});

// Suppliers API
export const SuppliersListQuerySchema = BaseQueryParamsSchema.extend({
  q: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

export const SuppliersCreateRequestSchema = z.object({
  name: z.string().min(2).max(100),
  taxId: z.string().regex(/^\d{9}$/).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().max(200).optional(),
  contactPerson: z.string().max(100).optional(),
  website: z.string().url().optional(),
  notes: z.string().max(500).optional(),
});

// ==================== TYPE INFERENCE ====================

export type PaginationInput = z.infer<typeof PaginationInputSchema>;
export type DateRangeFilter = z.infer<typeof DateRangeFilterSchema>;
export type OrdersListQuery = z.infer<typeof OrdersListQuerySchema>;
export type OrdersCreateRequest = z.infer<typeof OrdersCreateRequestSchema>;
export type OrdersUpdateStatusRequest = z.infer<typeof OrdersUpdateStatusRequestSchema>;
export type SuppliersListQuery = z.infer<typeof SuppliersListQuerySchema>;
export type SuppliersCreateRequest = z.infer<typeof SuppliersCreateRequestSchema>;

// ==================== VALIDATION HELPERS ====================

/**
 * Validates an API request against a schema
 */
export function validateApiRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Result<T, z.ZodError> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validates API response structure
 */
export function validateApiResponse<T>(
  dataSchema: z.ZodSchema<T>,
  response: unknown
): Result<ApiSuccessResponse<T>, z.ZodError> {
  const responseSchema = ApiResponseSchema(dataSchema);
  const result = responseSchema.safeParse(response);
  
  if (result.success && result.data.success) {
    return { success: true, data: result.data as ApiSuccessResponse<T> };
  }
  
  return { 
    success: false, 
    error: result.success ? new z.ZodError([]) : result.error 
  };
}

/**
 * Creates a type-safe API client method
 */
export function createApiMethod<
  TQuery = never,
  TBody = never,
  TResponse = never
>(
  method: string,
  path: string,
  options?: {
    querySchema?: z.ZodSchema<TQuery>;
    bodySchema?: z.ZodSchema<TBody>;
    responseSchema?: z.ZodSchema<TResponse>;
  }
) {
  // Suppress unused variable warning for future use
  void method;
  void path;
  return async (params: {
    query?: TQuery;
    body?: TBody;
    pathParams?: Record<string, string>;
  }): Promise<Result<TResponse, Error>> => {
    try {
      // Validate inputs
      if (options?.querySchema && params.query) {
        const queryResult = options.querySchema.safeParse(params.query);
        if (!queryResult.success) {
          return { success: false, error: new Error('Invalid query parameters') };
        }
      }
      
      if (options?.bodySchema && params.body) {
        const bodyResult = options.bodySchema.safeParse(params.body);
        if (!bodyResult.success) {
          return { success: false, error: new Error('Invalid request body') };
        }
      }
      
      // Make API call (implementation would go here)
      // This is a placeholder - actual implementation would use fetch/axios
      
      return { success: false, error: new Error('Not implemented') };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  };
}

// ==================== LEGACY COMPATIBILITY ====================

// Legacy aliases for backward compatibility
export const OrdersFilter = OrdersListQuerySchema;
export type ListResponse<T = any> = {
  items: T[];
  meta: z.infer<typeof PaginationMetaSchema>;
};

// Re-export utility type for compatibility
import type { Result } from '@/types/utilities';
export type { Result };
