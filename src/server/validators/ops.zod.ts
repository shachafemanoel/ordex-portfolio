import { z } from 'zod';

/** Validation schema for GET /api/v1/ops/queues query params */
export const opsQueuesQuerySchema = z.object({
  scope: z.enum(['orders', 'shipments']),
  tab: z.enum(['new', 'future', 'active']).default('active'),
});

export type OpsQueuesQuery = z.infer<typeof opsQueuesQuerySchema>;

/** Validation schema for POST /api/v1/ops/orders/[id]/action */
export const opsActionSchema = z.object({
  actionType: z.enum([
    'START',
    'COMPLETE',
    'DEFER',
    'SPLIT',
    'CANCEL',
    'MARK_PICKED',
    'MARK_DELIVERED',
    'SET_CUSTOMER_WAIT',
  ]),
  payload: z
    .object({
      reason: z.string().optional(),
      until: z.string().datetime().optional(),
      items: z
        .array(
          z.object({
            productId: z.string(),
            qty: z.number().int().min(1),
          }),
        )
        .optional(),
      estimatedDays: z.number().int().min(1).max(60).optional(),
      estimatedDeliveryAt: z.string().datetime().optional(),
    })
    .optional()
    .default({}),
});

export type OpsActionInput = z.infer<typeof opsActionSchema>;
