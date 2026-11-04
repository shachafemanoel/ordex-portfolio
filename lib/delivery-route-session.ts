import { z } from 'zod';

const nullableFiniteNumberSchema = z.number().finite().nullable();

export const deliveryRouteCoordinateSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
]);

export const deliveryRouteGroupSummarySchema = z.object({
  routeStopCount: z.number().int().nonnegative().optional(),
  routeDurationMinutes: z.number().finite().nullable().optional(),
  routeDistanceKm: z.number().finite().nullable().optional(),
  effectiveWorkloadMinutes: z.number().finite().nullable().optional(),
});

export const deliverySessionStopSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  status: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().nullable(),
  city: z.string().nullable(),
  addressLine: z.string().min(1),
  scheduledAt: z.string().nullable(),
  notes: z.string().nullable(),
  lat: nullableFiniteNumberSchema,
  lng: nullableFiniteNumberSchema,
  itemsSummary: z.string().nullable(),
  itemLabels: z.array(z.string()),
  itemsCount: z.number().int().nonnegative(),
  etaMinutes: z.number().finite().nullable(),
  distanceKm: z.number().finite().nullable(),
  routeIndex: z.number().int().nullable(),
  estimatedArrivalAt: z.string().nullable(),
  estimatedCompletionAt: z.string().nullable(),
});

export const deliveryRouteGroupSnapshotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  color: z.string().nullable().optional(),
  workerIndex: z.number().int().positive().nullable().optional(),
  items: z.array(deliverySessionStopSchema).min(1),
  routeCoordinates: z.array(deliveryRouteCoordinateSchema).default([]),
  summary: deliveryRouteGroupSummarySchema.nullable().optional(),
});

export const startDeliveryRouteSessionSchema = z.object({
  routeDateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  routeGroup: deliveryRouteGroupSnapshotSchema,
});

export const deliveryRouteSessionLocationSchema = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  accuracyMeters: z.number().finite().nullable().optional(),
  recordedAt: z.string().datetime().nullable().optional(),
});

export const updateDeliveryRouteSessionSchema = z.discriminatedUnion('actionType', [
  z.object({
    actionType: z.literal('MARK_ARRIVED'),
    orderId: z.string().min(1),
  }),
  z.object({
    actionType: z.literal('DEFER_STOP'),
    orderId: z.string().min(1),
  }),
  z.object({
    actionType: z.literal('COMPLETE_STOP'),
    orderId: z.string().min(1),
  }),
  z.object({
    actionType: z.literal('UPDATE_LOCATION'),
    location: deliveryRouteSessionLocationSchema,
  }),
  z.object({
    actionType: z.literal('RELEASE_SESSION'),
  }),
]);

export const deliveryRouteSessionStatusSchema = z.enum([
  'ACTIVE',
  'COMPLETED',
  'RELEASED',
  'SUPERSEDED',
]);

export const deliveryRouteSessionSchema = z.object({
  id: z.string().min(1),
  status: deliveryRouteSessionStatusSchema,
  routeDateKey: z.string().nullable(),
  routeGroup: deliveryRouteGroupSnapshotSchema,
  queueOrderIds: z.array(z.string()),
  queue: z.array(deliverySessionStopSchema),
  completedOrderIds: z.array(z.string()),
  deferredOrderIds: z.array(z.string()),
  arrivedOrderIds: z.array(z.string()),
  currentOrderId: z.string().nullable(),
  currentStop: deliverySessionStopSchema.nullable(),
  lastKnownLocation: deliveryRouteSessionLocationSchema.nullable(),
  startedAt: z.string(),
  lastActivityAt: z.string(),
  completedAt: z.string().nullable(),
  releasedAt: z.string().nullable(),
});

export const deliveryRouteSessionResponseSchema = z.object({
  success: z.boolean().optional(),
  data: deliveryRouteSessionSchema.nullable().optional(),
});

export type DeliveryRouteGroupSummarySnapshot = z.infer<
  typeof deliveryRouteGroupSummarySchema
>;
export type DeliverySessionStopSnapshot = z.infer<typeof deliverySessionStopSchema>;
export type DeliveryRouteGroupSnapshot = z.infer<typeof deliveryRouteGroupSnapshotSchema>;
export type StartDeliveryRouteSessionInput = z.infer<
  typeof startDeliveryRouteSessionSchema
>;
export type DeliveryRouteSessionLocation = z.infer<
  typeof deliveryRouteSessionLocationSchema
>;
export type UpdateDeliveryRouteSessionInput = z.infer<
  typeof updateDeliveryRouteSessionSchema
>;
export type DeliveryRouteSessionData = z.infer<typeof deliveryRouteSessionSchema>;

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

export function normalizeDeliveryRouteCoordinates(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => deliveryRouteCoordinateSchema.safeParse(entry))
    .filter((entry) => entry.success)
    .map((entry) => entry.data);
}

export function normalizeDeliverySessionStops(value: unknown): DeliverySessionStopSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => deliverySessionStopSchema.safeParse(entry))
    .filter((entry) => entry.success)
    .map((entry) => entry.data);
}
