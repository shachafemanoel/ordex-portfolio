import { normalizeOrderStatus } from '@/lib/orderStatus';
import { z } from 'zod';

export const emailSchema = z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal(''));
export const phoneSchema = z
  .string()
  .regex(/^[\d\-\+\(\)\s]+$/, 'מספר טלפון לא תקין')
  .optional()
  .or(z.literal(''));

const addressDetailsSchema = z.object({
  city: z.string().min(1, 'עיר היא שדה חובה').max(100, 'שם העיר ארוך מדי'),
  street: z.string().min(1, 'רחוב הוא שדה חובה').max(150, 'שם הרחוב ארוך מדי'),
  number: z.string().min(1, 'מספר בית נדרש').max(20, 'מספר בית ארוך מדי'),
  floor: z.string().max(10, 'מספר קומה ארוך מדי').optional().or(z.literal('')),
  apartment: z.string().max(50, 'מספר דירה ארוך מדי').optional().or(z.literal('')),
  notes: z.string().max(200, 'הערות ארוכות מדי').optional().or(z.literal('')),
});

const manualOrderItemSchema = z.object({
  sku: z.string().max(64, 'קוד מק״ט ארוך מדי').optional().or(z.literal('')),
  name: z.string().min(1, 'שם הפריט נדרש').max(200, 'שם הפריט ארוך מדי'),
  quantity: z.number().int().positive('כמות חייבת להיות חיובית'),
  unitPrice: z.number().positive('מחיר ליחידה חייב להיות גדול מאפס'),
  vatRate: z.number().min(0).max(1).optional(),
});

const orderItemInputSchema = z.object({
  productId: z.string().uuid('מזהה מוצר לא תקין').nullable().optional(),
  sku: z.string().max(64, 'קוד מק״ט ארוך מדי').optional().or(z.literal('')),
  name: z.string().min(1, 'שם הפריט נדרש').max(200, 'שם הפריט ארוך מדי'),
  quantity: z.number().int().positive('כמות חייבת להיות חיובית').optional(),
  qtyRequested: z.number().int().positive('כמות חייבת להיות חיובית').optional(),
  pricePerUnit: z.number().positive('מחיר ליחידה חייב להיות גדול מאפס').optional(),
  priceCents: z.number().int().positive('מחיר ליחידה חייב להיות גדול מאפס').optional(),
  supplierId: z.string().uuid('מזהה ספק לא תקין').nullable().optional(),
  remarks: z.string().max(500, 'הערות ארוכות מדי').optional().or(z.literal('')),
  inventoryEnabled: z.boolean().optional(),
  procurementRequired: z.boolean().optional(),
  serialNumberType: z.enum(['NONE', 'AUTO', 'MANUAL']).optional(),
});

/**
 * Transform and normalize order item input
 *
 * IMPORTANT: Price conversion logic
 * - Input from client: priceCents (already in cents, e.g., 10000 = 100 ILS)
 * - Transform to: pricePerUnit (in shekels for service layer, e.g., 100)
 * - Service layer will convert back to cents for storage
 *
 * This two-way conversion ensures:
 * 1. Client sends cents (consistent storage format)
 * 2. Validator normalizes to shekels (business logic format)
 * 3. Service converts back to cents (final storage)
 */
const orderItemSchema = orderItemInputSchema
  .transform((item) => {
    const quantity = item.quantity ?? item.qtyRequested;

    // Convert priceCents to pricePerUnit (cents → shekels)
    // Example: priceCents = 10000 → pricePerUnit = 100.00 ILS
    const pricePerUnit =
      item.pricePerUnit ??
      (typeof item.priceCents === 'number' ? item.priceCents / 100 : undefined);

    const supplierId = item.supplierId || undefined;

    return {
      productId: item.productId ?? item.productId,
      sku: item.sku?.trim() || undefined,
      name: item.name,
      quantity: quantity === undefined ? undefined : Number(quantity),
      pricePerUnit: pricePerUnit === undefined ? undefined : Number(pricePerUnit),
      supplierId,
      remarks: item.remarks?.trim() || undefined,
      inventoryEnabled: item.inventoryEnabled,
      procurementRequired: item.procurementRequired,
      serialNumberType: item.serialNumberType,
    };
  })
  .superRefine((item, ctx) => {
    // Modified: Allow missing productId (Custom Items)
    // if (!item.productId) { ... }

    if (!item.quantity || item.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'כמות חייבת להיות גדולה מאפס',
        path: ['quantity'],
      });
    }

    if (item.pricePerUnit === undefined || item.pricePerUnit <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'מחיר ליחידה חייב להיות גדול מאפס',
        path: ['pricePerUnit'],
      });
    }
  });

export const OrderUpdateSchema = z.object({
  customer: z.object({
    name: z.string().min(2, 'שם הלקוח חייב להכיל לפחות 2 תווים').max(100),
    email: emailSchema,
    phone: phoneSchema,
  }),
  billingAddress: addressDetailsSchema,
  shippingAddress: addressDetailsSchema,
  items: z.array(manualOrderItemSchema).min(1, 'חובה להוסיף לפחות פריט אחד'),
  currency: z.string().length(3).default('ILS'),
  notesInternal: z.string().max(500, 'הערות ארוכות מדי').optional().or(z.literal('')),
  shippingCost: z.number().nonnegative('עלות משלוח חייבת להיות חיובית').optional(),
  discount: z.number().nonnegative('הנחה חייבת להיות חיובית').optional(),

  // Ops Board
  opsLane: z.string().optional(),
  opsStatus: z.string().nullable().optional(),
  checklistState: z.record(z.any()).optional(),
});

export const orderFormSchema = OrderUpdateSchema;

export const statusUpdateSchema = z.object({
  status: z.string(),
  reason: z.string().optional(),
  installerName: z.string().optional(),
  installerNotes: z.string().optional(),
  installAt: z.string().optional(),
});

export const OrderPaymentSchema = z.object({
  method: z.enum(
    [
      'CASH',
      'CHECK',
      'BANK_TRANSFER',
      'CREDIT_CARD',
      'DEBIT_CARD',
      'BIT',
      'PAYPAL',
      'STRIPE',
      'OTHER',
    ],
    {
      errorMap: () => ({ message: 'אמצעי תשלום לא תקין' }),
    }
  ),
  amountCents: z.number().int().nonnegative('סכום חייב להיות אפס ומעלה'),
  status: z
    .enum(['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL'])
    .default('PENDING'),
  reference: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
  externalId: z.string().max(200).optional().or(z.literal('')),
  paymentDate: z.preprocess(
    (val) => (val ? new Date(val as string) : undefined),
    z.date().optional()
  ),
});

export const OrderCreateSchema = z.object({
  customerId: z.string().uuid('מזהה לקוח חסר או לא תקין'),
  billingAddressId: z.string().uuid('מזהה כתובת לחיוב לא תקין').optional(),
  shippingAddressId: z.string().uuid('מזהה כתובת למשלוח לא תקין').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  notes: z.string().max(1000, 'הערות ארוכות מדי').optional().or(z.literal('')),
  items: z.array(orderItemSchema).min(1, 'חובה לכלול לפחות פריט אחד'),
  payment: OrderPaymentSchema.optional(),
  /** Client-only metrics (stripped before domain create); not used for payment gateways. */
  clientInstrumentation: z
    .object({
      orderWizardDurationMs: z.number().int().min(0).max(3_600_000).optional(),
    })
    .strict()
    .optional(),
});
export const OrdersQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => normalizeOrderStatus(s)) : undefined)),
  includeDeleted: z
    .string()
    .optional()
    .transform((val) => (val ? ['true', '1', 'yes', 'on'].includes(val.toLowerCase()) : undefined)),
  includeDemo: z
    .string()
    .optional()
    .transform((val) => (val ? ['true', '1', 'yes', 'on'].includes(val.toLowerCase()) : undefined)),
  demo: z
    .string()
    .optional()
    .transform((val) => (val ? ['true', '1', 'yes', 'on'].includes(val.toLowerCase()) : undefined)),
  includeItems: z
    .string()
    .optional()
    .transform((val) => (val ? ['true', '1', 'yes', 'on'].includes(val.toLowerCase()) : undefined)),
  tab: z.enum(['now', 'later', 'ready', 'sent']).optional(),
  q: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  scheduledAt: z.string().optional(),
  scheduledAtFrom: z.string().optional(),
  scheduledAtTo: z.string().optional(),
  includeUnscheduledReady: z
    .string()
    .optional()
    .transform((val) =>
      val ? ['true', '1', 'yes', 'on'].includes(val.toLowerCase()) : false
    ),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  sort: z
    .enum([
      'createdAt',
      'updatedAt',
      'scheduledAt',
      'number',
      'customerName',
      'totalAmount',
      'status',
    ])
    .default('createdAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  userId: z.string().optional(),
  clientId: z.string().optional(),
  city: z.string().optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
});

export type OrderCreateInput = z.input<typeof OrderCreateSchema>;
export type OrderCreateParsed = z.output<typeof OrderCreateSchema>;
export type OrderCreateItemInput = z.input<typeof orderItemInputSchema>;
export type OrderPaymentInput = z.input<typeof OrderPaymentSchema>;
export type OrderPaymentParsed = z.output<typeof OrderPaymentSchema>;
