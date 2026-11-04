import { z } from 'zod';

export const kpiBlockSchema = z.object({
  type: z.literal('kpis'),
  items: z.array(
    z.object({
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      helper: z.string().optional(),
      trend: z
        .object({
          direction: z.enum(['up', 'down', 'flat']).default('flat'),
          value: z.number().optional(),
        })
        .optional(),
      status: z.enum(['ok', 'warn', 'alert']).optional(),
    })
  ),
});

export const tableBlockSchema = z.object({
  type: z.literal('table'),
  columns: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      align: z.enum(['left', 'center', 'right']).default('right').optional(),
      format: z.enum(['text', 'currency', 'date', 'status']).default('text').optional(),
      width: z.string().optional(),
    })
  ),
  rows: z.array(z.record(z.any())),
  emptyText: z.string().optional(),
});

export const cardsBlockSchema = z.object({
  type: z.literal('cards'),
  items: z.array(
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      value: z.union([z.string(), z.number()]).optional(),
      badge: z.string().optional(),
      meta: z.record(z.any()).optional(),
    })
  ),
});

export const mapPinsBlockSchema = z.object({
  type: z.literal('mapPins'),
  pins: z.array(
    z.object({
      id: z.string(),
      lat: z.number(),
      lng: z.number(),
      label: z.string(),
      status: z.string(),
      city: z.string().optional(),
      orderNumber: z.string().optional(),
      customerName: z.string().optional(),
      amount: z.number().optional(),
      scheduledAt: z.string().optional(),
    })
  ),
  filters: z
    .object({
      status: z.array(z.string()).optional(),
    })
    .optional(),
});

export const textBlockSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
  tone: z.enum(['info', 'warn', 'success']).default('info').optional(),
});

export const blockSchema = z.discriminatedUnion('type', [
  kpiBlockSchema,
  tableBlockSchema,
  cardsBlockSchema,
  mapPinsBlockSchema,
  textBlockSchema,
]);

export const nextSuggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  paramsHint: z.record(z.any()).default({}).optional(),
});

export const statePatchSchema = z.object({
  lastActionId: z.string().optional(),
  lastFilters: z.record(z.any()).optional(),
  selectedOrderIds: z.array(z.string()).optional(),
  geminiCacheId: z.string().optional(),
});

export const uiPayloadSchema = z.object({
  title: z.string(),
  view: z.enum(['dashboard', 'report', 'order_list', 'order_detail', 'map', 'calendar', 'toast_only', 'chat']),
  blocks: z.array(blockSchema).default([]),
  nextSuggestions: z.array(nextSuggestionSchema).default([]),
  statePatch: statePatchSchema.optional(),
  meta: z.record(z.any()).optional(),
});

export type UIPayload = z.infer<typeof uiPayloadSchema>;
export type UIPayloadBlock = z.infer<typeof blockSchema>;
export type NextSuggestion = z.infer<typeof nextSuggestionSchema>;
export type StatePatch = z.infer<typeof statePatchSchema>;
