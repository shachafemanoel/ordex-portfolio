import { createSuccessResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { getFinanceDashboardData } from '@/lib/services/dashboard/FinanceDashboardService';
import type { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser) => {
    const data = await getFinanceDashboardData();
    return createSuccessResponse(data);
  },
  { roles: [UserRole.ADMIN, UserRole.OPERATIONS] }
);
