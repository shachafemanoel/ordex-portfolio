export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { opsQueuesQuerySchema } from '@/src/server/validators/ops.zod';
import { getOpsQueues } from '@/src/server/services/ops-queues.service';

/**
 * GET /api/v1/ops/queues
 *
 * Returns queue-based views for the daily operational boards.
 * Query params:
 *   scope: 'orders' | 'shipments'
 *   tab:   'new' | 'future' (default: 'new')
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = opsQueuesQuerySchema.safeParse({
      scope: searchParams.get('scope'),
      tab: searchParams.get('tab') ?? undefined,
    });

    if (!parsed.success) {
      return createErrorResponse(
        `Invalid query params: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        400,
      );
    }

    const { scope, tab } = parsed.data;
    const data = await getOpsQueues(scope, tab);
    return createSuccessResponse(data);
  } catch (error) {
    console.error('Failed to fetch ops queues:', error);
    return createErrorResponse('Failed to fetch ops queues', 500);
  }
});
