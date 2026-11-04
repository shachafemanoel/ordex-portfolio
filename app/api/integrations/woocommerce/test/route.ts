import { createErrorResponse, createSuccessResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { checkSavedConnection, testConnection } from '@/lib/integrations/woocommerce/connection';
import { ADMIN_ONLY_MESSAGE, ConnectSchema, storeErrorResponse } from '@/lib/integrations/woocommerce/api';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * With keys in the body: checks them without saving. Without a body: checks the saved
 * connection, including whether the store still has our webhooks switched on.
 */
export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  if (user.role !== 'ADMIN') return createErrorResponse(ADMIN_ONLY_MESSAGE, 403);
  const body = await req.json().catch(() => null);
  try {
    if (!body || Object.keys(body).length === 0) {
      return createSuccessResponse(await checkSavedConnection(), undefined, 'החיבור תקין');
    }
    const parsed = ConnectSchema.safeParse(body);
    if (!parsed.success) return createErrorResponse(parsed.error.issues[0]?.message ?? 'בקשה לא תקינה', 400);
    await testConnection(parsed.data);
    return createSuccessResponse({ ok: true }, undefined, 'החיבור תקין');
  } catch (error) {
    return storeErrorResponse(error);
  }
});
