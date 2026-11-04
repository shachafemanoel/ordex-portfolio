import { createErrorResponse, createSuccessResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { ADMIN_ONLY_MESSAGE, ConnectSchema, storeErrorResponse } from '@/lib/integrations/woocommerce/api';
import { connect, disconnect, getConnection } from '@/lib/integrations/woocommerce/connection';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req: NextRequest, user: AuthenticatedUser) => {
  if (user.role !== 'ADMIN') return createErrorResponse(ADMIN_ONLY_MESSAGE, 403);
  return createSuccessResponse(await getConnection());
});

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  if (user.role !== 'ADMIN') return createErrorResponse(ADMIN_ONLY_MESSAGE, 403);
  const parsed = ConnectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return createErrorResponse(parsed.error.issues[0]?.message ?? 'בקשה לא תקינה', 400);
  }
  try {
    return createSuccessResponse(await connect(parsed.data), undefined, 'החנות חוברה');
  } catch (error) {
    return storeErrorResponse(error);
  }
});

export const DELETE = withAuth(async (_req: NextRequest, user: AuthenticatedUser) => {
  if (user.role !== 'ADMIN') return createErrorResponse(ADMIN_ONLY_MESSAGE, 403);
  return createSuccessResponse(await disconnect(), undefined, 'החיבור לחנות נותק');
});
