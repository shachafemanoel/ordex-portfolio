export const dynamic = 'force-dynamic';

import {
  createSuccessResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { parseOrderVersionToken } from '@/lib/orders/concurrency';
import { mapErrorToResponse } from '@/lib/server/errors';
import { updateItemAllocation } from '@/lib/services/orders';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const allocationStatusSchema = z.enum(['PENDING', 'ALLOCATED', 'OUT_OF_STOCK', 'ON_ORDER']);

const updateAllocationSchema = z
  .object({
    status: allocationStatusSchema.optional(),
    source: z.enum(['STOCK', 'SUPPLIER']).optional(),
    supplierId: z.string().uuid().nullable().optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .refine((value) => value.status || value.source, {
    message: 'Either status or source is required',
    path: ['status'],
  });

export const PATCH = withAuth(
  async (
    req: NextRequest,
    user: AuthenticatedUser,
    { params }: { params: { id: string; itemId: string } }
  ) => {
    try {
      const { id: orderId, itemId } = params;
      const body = (await validateRequest(updateAllocationSchema)(req)) as z.infer<
        typeof updateAllocationSchema
      >;
      const resolvedStatus =
        body.status ?? (body.source === 'STOCK' ? 'ALLOCATED' : 'ON_ORDER');
      const expectedVersionToken =
        body.expectedUpdatedAt ??
        req.headers.get('if-match') ??
        req.headers.get('if-unmodified-since');
      const expectedUpdatedAt = parseOrderVersionToken(expectedVersionToken);

      if (expectedVersionToken && !expectedUpdatedAt) {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ['expectedUpdatedAt'],
            message: 'Invalid expectedUpdatedAt / If-Match header format',
          },
        ]);
      }

      const updatedItem = await updateItemAllocation(orderId, itemId, resolvedStatus, user.id, {
        expectedUpdatedAt,
        supplierId: body.supplierId,
      });

      return createSuccessResponse(updatedItem, undefined, 'Item allocation updated');
    } catch (error) {
      logger.error('Failed to update item allocation', error);
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;
      throw error;
    }
  }
);
