export const dynamic = 'force-dynamic';

import { createDataResponse, createErrorResponse, withErrorHandler } from '@/lib/api-middleware';
import { getCurrentUser } from '@/lib/auth/verifySession';
import { getOrdersService } from '@/lib/services/ServiceFactory';
import { endOfDay, startOfDay } from 'date-fns';
import { NextRequest } from 'next/server';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) {
    return createErrorResponse('Unauthorized', 401);
  }

  const service = getOrdersService();
  const today = new Date();
  const start = startOfDay(today);
  const end = endOfDay(today);

  // 1. Fetch Scheduled Orders for Today
  const scheduledResult = await service.listOrders(
    {
      scheduledAt: today.toISOString(),
      includeDeleted: false,
    } as any,
    { limit: 50, sortBy: 'scheduledAt:asc' }
  );

  // 2. Fetch Overdue Orders
  const overdueResult = await service.listOrders(
    {
      overdue: true,
      includeDeleted: false,
    } as any,
    { limit: 50, sortBy: 'dueDate:asc' }
  );

  return createDataResponse(
    {
      scheduled: scheduledResult.items,
      overdue: overdueResult.items,
      metrics: {
        scheduledCount: scheduledResult.pagination.total,
        overdueCount: overdueResult.pagination.total,
        todayTotalCents: scheduledResult.items.reduce((acc, o) => acc + (o.totalCents || 0), 0),
      },
    },
    req
  );
});
