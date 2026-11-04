import { withAuth, type AuthenticatedUser, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { getAllStatuses } from '@/lib/orderStatus';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser) => {
    const statuses = getAllStatuses();
    const counts = await prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { deletedAt: null },
    });

    const statusCounts: Record<string, number> = Object.fromEntries(
      statuses.map((s) => [s, 0])
    );
    counts.forEach((row) => {
      statusCounts[row.status] = row._count._all;
    });

    return createSuccessResponse({ statusCounts });
  },
  { permissions: ['VIEW_ORDERS'] }
);
