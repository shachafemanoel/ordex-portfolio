import { z } from 'zod';

/**
 * Quote Creation Schema
 * Used for creating quotes via POST /api/deals with line items
 */
export const QuoteCreateSchema = z.object({
  name: z.string().min(1, 'שם הצעת מחיר נדרש').optional(),
  customerId: z.string().uuid('מזהה לקוח לא תקין'),
  stage: z
    .enum([
      'PROSPECTING',
      'QUALIFICATION',
      'NEEDS_ANALYSIS',
      'PROPOSAL',
      'NEGOTIATION',
      'CLOSED_WON',
      'CLOSED_LOST',
    ])
    .default('PROPOSAL'),
  probability: z.number().int().min(0).max(100, 'סבירות חייבת להיות בין 0-100').default(50),
  expectedCloseDate: z.string().datetime().optional().nullable(),

  // Line items (required for quotes)
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        sku: z.string().optional(),
        name: z.string().min(1, 'שם פריט נדרש'),
        quantity: z.number().positive('כמות חייבת להיות חיובית'),
        pricePerUnit: z.number().nonnegative('מחיר חייב להיות אפס או חיובי'),
        supplierId: z.string().uuid().optional(),
        remarks: z.string().optional(),
        inventoryEnabled: z.boolean().optional(),
        procurementRequired: z.boolean().optional(),
        serialNumberType: z.enum(['NONE', 'AUTO', 'MANUAL']).optional(),
      })
    )
    .min(1, 'חייב לפחות פריט אחד'),

  // Payment info (optional at creation)
  payment: z
    .object({
      method: z.string(),
      amountCents: z.number().int().positive(),
      status: z.enum(['PENDING', 'PAID', 'FAILED']),
      reference: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

/**
 * Payment Add Schema
 * Used for adding payments to quotes via POST /api/deals/:id/payments
 */
export const PaymentAddSchema = z.object({
  method: z.string().min(1, 'שיטת תשלום נדרשת'),
  amountCents: z.number().int().positive('סכום חייב להיות חיובי'),
  status: z.enum(['PENDING', 'PAID', 'FAILED']),
  paymentDate: z.string().datetime().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Convert to Order Schema
 * Used for converting quotes to orders via POST /api/deals/:id/convert-to-order
 */
export const ConvertToOrderSchema = z.object({
  adminOverride: z.boolean().optional(),
  overrideReason: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

/**
 * Cancel Quote Schema
 * Used for cancelling quotes via POST /api/deals/:id/cancel
 */
export const CancelQuoteSchema = z.object({
  reason: z.string().min(1, 'סיבת ביטול נדרשת'),
});

export type QuoteCreateInput = z.infer<typeof QuoteCreateSchema>;
export type PaymentAddInput = z.infer<typeof PaymentAddSchema>;
export type ConvertToOrderInput = z.infer<typeof ConvertToOrderSchema>;
export type CancelQuoteInput = z.infer<typeof CancelQuoteSchema>;
