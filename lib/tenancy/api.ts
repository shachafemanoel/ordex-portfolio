import { createErrorResponse, handleApiError, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { NextRequest } from 'next/server';

export function tenantRoute(
  handler: (req: NextRequest, user: AuthenticatedUser) => Promise<Response>,
  admin = false
) {
  return withAuth(async (req, user) => {
    if (!user.tenantId) return createErrorResponse('Business membership required', 401);
    if (admin && user.role !== 'ADMIN') return createErrorResponse('נדרשת הרשאת מנהל עסק', 403);
    try {
      const response = await handler(req, user);
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    } catch (error) {
      return handleApiError(error, req);
    }
  });
}
