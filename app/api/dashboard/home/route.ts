import { createSuccessResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { loadDashboardHomeViewModelJson } from '@/lib/server/dashboard-home-view-model';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req: NextRequest, user: AuthenticatedUser) => {
  const data = await loadDashboardHomeViewModelJson(user.name);
  return createSuccessResponse(data);
});
