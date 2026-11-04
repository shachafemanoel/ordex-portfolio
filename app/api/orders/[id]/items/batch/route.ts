export const dynamic = 'force-dynamic';

import {
  createSuccessResponse,
  ValidationError,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { parseOrderVersionToken } from '@/lib/orders/concurrency';
import { prisma } from '@/lib/db';
import { mapErrorToResponse } from '@/lib/server/errors';
import {
  AllocationStatusValue,
  ItemAllocationUpdateInput,
  updateItemsAllocationBatch,
} from '@/lib/services/orders';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const allocationStatusSchema = z.enum(['PENDING', 'ALLOCATED', 'OUT_OF_STOCK', 'ON_ORDER']);

const batchAllocationUpdateSchema = z
  .object({
    itemId: z.string().uuid(),
    status: allocationStatusSchema.optional(),
    source: z.enum(['STOCK', 'SUPPLIER']).optional(),
    supplierId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => value.status || value.source, {
    message: 'Each update must include status or source',
    path: ['status'],
  });

const newBatchSchema = z.object({
  updates: z.array(batchAllocationUpdateSchema).min(1),
  expectedUpdatedAt: z.string().datetime().optional(),
});

const legacyBatchSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  action: z.enum(['APPROVE_SHIPMENT', 'TO_PURCHASING', 'SET_STATUS']),
  status: allocationStatusSchema.optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
});

/** Ops card "mark all ready" — same effect as legacy APPROVE_SHIPMENT for every line item */
const markAllAllocatedSchema = z.object({
  action: z.literal('MARK_ALL_ALLOCATED'),
  expectedUpdatedAt: z.string().datetime().optional(),
});

type NewBatchPayload = z.infer<typeof newBatchSchema>;
type LegacyBatchPayload = z.infer<typeof legacyBatchSchema>;
type MarkAllAllocatedPayload = z.infer<typeof markAllAllocatedSchema>;

function resolveStatusFromSource(
  input: Pick<z.infer<typeof batchAllocationUpdateSchema>, 'status' | 'source'>
): AllocationStatusValue {
  if (input.status) return input.status;
  return input.source === 'STOCK' ? 'ALLOCATED' : 'ON_ORDER';
}

function mapNewPayload(payload: NewBatchPayload): ItemAllocationUpdateInput[] {
  return payload.updates.map((update) => ({
    itemId: update.itemId,
    status: resolveStatusFromSource(update),
    supplierId: update.supplierId,
  }));
}

function mapLegacyPayload(payload: LegacyBatchPayload): ItemAllocationUpdateInput[] {
  let resolvedStatus: AllocationStatusValue | null = null;

  if (payload.action === 'APPROVE_SHIPMENT') {
    resolvedStatus = 'ALLOCATED';
  } else if (payload.action === 'TO_PURCHASING') {
    resolvedStatus = 'ON_ORDER';
  } else {
    resolvedStatus = payload.status ?? null;
  }

  if (!resolvedStatus) {
    throw new ValidationError('status is required for SET_STATUS');
  }

  return payload.itemIds.map((itemId) => ({
    itemId,
    status: resolvedStatus as AllocationStatusValue,
  }));
}

async function mapMarkAllAllocatedPayload(orderId: string): Promise<ItemAllocationUpdateInput[]> {
  const rows = await prisma.orderItem.findMany({
    where: { orderId },
    select: { id: true },
  });
  return rows.map((row) => ({ itemId: row.id, status: 'ALLOCATED' }));
}

export const POST = withAuth(
  async (
    req: NextRequest,
    user: AuthenticatedUser,
    { params }: { params: { id: string } }
  ) => {
    try {
      const orderId = params.id;
      const body = await req.json();

      const parsedNew = newBatchSchema.safeParse(body);
      const parsedLegacy = parsedNew.success ? null : legacyBatchSchema.safeParse(body);
      const parsedMarkAll =
        parsedNew.success || (parsedLegacy && parsedLegacy.success)
          ? null
          : markAllAllocatedSchema.safeParse(body);

      if (
        !parsedNew.success &&
        !(parsedLegacy && parsedLegacy.success) &&
        !(parsedMarkAll && parsedMarkAll.success)
      ) {
        throw new ValidationError('Invalid request body', {
          newBatchErrors: parsedNew.error.flatten(),
          legacyBatchErrors: parsedLegacy?.error.flatten(),
          markAllAllocatedErrors: parsedMarkAll?.error.flatten(),
        });
      }

      let updates: ItemAllocationUpdateInput[];
      let expectedVersionTokenFromBody: string | undefined;

      if (parsedNew.success) {
        updates = mapNewPayload(parsedNew.data);
        expectedVersionTokenFromBody = parsedNew.data.expectedUpdatedAt;
      } else if (parsedLegacy && parsedLegacy.success) {
        updates = mapLegacyPayload(parsedLegacy.data);
        expectedVersionTokenFromBody = parsedLegacy.data.expectedUpdatedAt;
      } else {
        const markPayload = (parsedMarkAll as { success: true; data: MarkAllAllocatedPayload }).data;
        updates = await mapMarkAllAllocatedPayload(orderId);
        expectedVersionTokenFromBody = markPayload.expectedUpdatedAt;
        if (updates.length === 0) {
          return createSuccessResponse(
            { count: 0, items: [] },
            undefined,
            'Batch allocation updated'
          );
        }
      }

      const expectedVersionToken =
        expectedVersionTokenFromBody ??
        req.headers.get('if-match') ??
        req.headers.get('if-unmodified-since');
      const expectedUpdatedAt = parseOrderVersionToken(expectedVersionToken);

      if (expectedVersionToken && !expectedUpdatedAt) {
        throw new ValidationError('Invalid expectedUpdatedAt / If-Match header format');
      }

      const result = await updateItemsAllocationBatch(orderId, updates, user.id, {
        expectedUpdatedAt,
      });

      return createSuccessResponse(
        {
          count: result.count,
          items: result.items,
        },
        undefined,
        'Batch allocation updated'
      );
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'batch_allocation_failed',
            message: error instanceof Error ? error.message : 'Batch allocation failed',
          },
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);

export const PATCH = POST;
