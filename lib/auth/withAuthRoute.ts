import { isTenantRuntime, withTenantContext } from '@/lib/tenancy/context';
import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-middleware';
import { SESSION_COOKIE_NAME } from '@/lib/auth/config';
import { AuthenticationError, SessionExpiredError } from '@/lib/auth/errors';
import { AuthenticatedUser, toAuthenticatedUser } from '@/lib/auth/types';
import { verifySessionFromRequest } from '@/lib/auth/verifySession';

/**
 * Higher-order function to protect API routes with authentication
 * Usage: export const GET = withAuth(async (req, user) => { ... });
 */
export function withAuth(
  handler: (
    req: NextRequest,
    user: AuthenticatedUser,
    ...args: any[]
  ) => Promise<NextResponse | Response> | NextResponse | Response,
  options?: {
    permissions?: readonly import('@/lib/auth/types').Permission[];
    roles?: readonly import('@prisma/client').UserRole[];
    requireAll?: boolean;
  }
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      // 1. Verify session from cookie or header
      const session = await verifySessionFromRequest(req);

      // 2. Hydrate user with permissions
      const authenticatedUser = toAuthenticatedUser(session.user);

      // 3. Check roles if required
      if (options?.roles?.length) {
        const { requireRole } = await import('@/lib/auth/requireRole');
        requireRole(authenticatedUser, options.roles);
      }

      // 4. Check permissions if required
      if (options?.permissions?.length) {
        const { requirePermissions } = await import('@/lib/auth/permissions');
        requirePermissions(authenticatedUser, options.permissions, options.requireAll);
      }

      // 5. Call the handler with the authenticated user
      // Next.js 15: params is a Promise. Await it if it exists in the context (last arg).
      const context = args[args.length - 1];
      if (context && context.params && typeof context.params.then === 'function') {
        const resolvedParams = await context.params;
        args[args.length - 1] = { ...context, params: resolvedParams };
      }

      const result = await (isTenantRuntime() && authenticatedUser.tenantId
        ? withTenantContext({ tenantId: authenticatedUser.tenantId, userId: authenticatedUser.id, role: authenticatedUser.role === 'ADMIN' ? 'ADMIN' : 'OPERATIONS' }, () => handler(req, authenticatedUser, ...args))
        : handler(req, authenticatedUser, ...args));

      // Normalize to NextResponse to satisfy Next.js route handler expectations
      if (result instanceof NextResponse) {
        return result;
      }

      return new NextResponse(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
      });
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        const response = NextResponse.json(
          {
            success: false,
            error: {
              code: 'session_expired',
              message: 'Session expired',
            },
          },
          { status: 401 }
        );
        response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
        return response;
      }

      if (error instanceof AuthenticationError) {
        return createErrorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
      }

      // Check for AuthorizationError (from requirePermissions)
      if (error instanceof Error && error.name === 'AuthorizationError') {
        return createErrorResponse('Forbidden', 403, { code: 'FORBIDDEN', message: error.message });
      }

      console.error('[withAuth] Unexpected error:', error);
      return createErrorResponse('Internal Server Error', 500);
    }
  };
}
