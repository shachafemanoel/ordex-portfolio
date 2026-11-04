// RBAC middleware for Next.js API routes

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth/service';
import { AuthContext, Permission } from '@/lib/types/auth';

// Custom error for authentication failures
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// Extended NextRequest with auth context
export interface AuthenticatedRequest extends NextRequest {
  auth?: AuthContext;
}

/**
 * Extract bearer token from Authorization header OR session cookie
 */
function extractBearerToken(request: NextRequest): string | null {
  // Try Authorization header first
  const authorization = request.headers.get('Authorization');

  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/);
    if (match) return match[1];
  }

  // Fallback to session cookie - check both the proper cookie name and legacy names
  const cookieHeader = request.headers.get('cookie');

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>
    );

    // Check for ordex.sid (primary) or ordex_session (legacy)
    return cookies['ordex.sid'] || cookies['ordex_session'] || null;
  }

  return null;
}

/**
 * RBAC middleware factory
 * @param requiredPermission - Permission required to access the endpoint
 * @returns Middleware function
 */
export function rbac(requiredPermission?: Permission) {
  return async function authMiddleware(request: AuthenticatedRequest): Promise<AuthContext> {
    try {
      let user = null;

      // 1. Try Authorization Header first
      const authorization = request.headers.get('Authorization');
      if (authorization) {
        const match = authorization.match(/^Bearer\s+(.+)$/);
        if (match) {
          const token = match[1];
          user = await AuthService.getUserByToken(token);
        }
      }

      // 2. If no user found from header, try session cookie
      if (!user) {
        const cookieHeader = request.headers.get('cookie');
        if (cookieHeader) {
          const cookies = cookieHeader.split(';').reduce(
            (acc, cookie) => {
              const [key, value] = cookie.trim().split('=');
              acc[key] = value;
              return acc;
            },
            {} as Record<string, string>
          );

          const cookieToken = cookies['ordex.sid'] || cookies['ordex_session'];
          if (cookieToken) {
            user = await AuthService.getUserByToken(cookieToken);
          }
        }
      }

      // 3. If still no user, throw error
      if (!user) {
        throw new AuthenticationError('Invalid or expired token');
      }

      // Create auth context
      const authContext = AuthService.createAuthContext(user);

      // Check permission if required
      if (requiredPermission && !authContext.hasPermission(requiredPermission)) {
        throw new AuthorizationError(`Missing required permission: ${requiredPermission}`);
      }

      // Attach auth context to request
      request.auth = authContext;

      return authContext;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        throw error;
      }

      // Log unexpected errors
      console.error('Auth middleware error:', error);
      throw new AuthenticationError('Authentication failed');
    }
  };
}

/**
 * Wrapper for API route handlers with authentication
 */
export function withAuth<T = any>(
  handler: (request: AuthenticatedRequest, auth: AuthContext) => Promise<NextResponse<T>>,
  requiredPermission?: Permission
) {
  return async function authenticatedHandler(
    request: AuthenticatedRequest
  ): Promise<NextResponse<T> | NextResponse<{ error: string }>> {
    try {
      const authMiddleware = rbac(requiredPermission);
      const auth = await authMiddleware(request);

      return await handler(request, auth);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
      }

      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
      }

      console.error('API route error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

/**
 * Utility to check if user has any of the given permissions
 */
export function hasAnyPermission(auth: AuthContext, permissions: Permission[]): boolean {
  return permissions.some((permission) => auth.hasPermission(permission));
}

/**
 * Utility to check if user has all of the given permissions
 */
export function hasAllPermissions(auth: AuthContext, permissions: Permission[]): boolean {
  return permissions.every((permission) => auth.hasPermission(permission));
}

/**
 * Admin-only middleware
 */
export const requireAdmin = rbac('admin:all');
