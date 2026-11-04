import { isMvpApiAllowed } from '@/lib/tenancy/mvp-routes';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionCookie } from '@/lib/auth/cookies';
import { isDemo } from '@/lib/featureFlags';
import {
  applySecurityToResponse,
  logSecurityEvent,
  securityMiddleware,
} from './lib/security-middleware';

// Protected routes that require authentication
const PROTECTED_PATHS = [
  /^\/admin/,
  /^\/api\/(orders|purchase-orders|users|suppliers|skus|clients)\/.*$/,
  /^\/api\/(integrations|reports|reminders|schedule)\/.*$/,
  /^\/api\/(agents|ai|dashboard|analytics|customers|maps|geocode)\/.*$/,
  /^\/api\/(finance|payments|products|installations|calendar|notifications)\/.*$/,
  /^\/api\/debug/,
];

// Write methods that require authorization
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Public API endpoints that don't need authentication but need security headers
// NOTE: Most endpoints now require authentication. Only truly public endpoints listed here.
const PUBLIC_API_PATHS = [
  /^\/api\/health/,
  /^\/api\/bootstrap/, // Allow bootstrap API for demo setup
  /^\/api\/auth\/login$/, // Login endpoint (public)
  /^\/api\/auth\/register$/, // Registration endpoint (public)
  /^\/api\/auth\/logout$/,
  /^\/api\/invitations\/accept$/,
  /^\/api\/webhooks\/woocommerce\/[^/]+$/, // Logout endpoint (public)
  /^\/api\/integrations\/webhook/,
  /^\/api\/integrations\/woocommerce\/webhook/,
  /^\/api\/integrations\/woocommerce\/webhooks/,
  /^\/api\/woo\/webhooks/,
  /^\/api\/woo\/webhooks\/order-created/,
  /^\/api\/security\/csp-report/,
  /^\/api\/orders\/demo\/action$/, // POST requests for demo actions only
  /^\/api\/admin\/seed-realistic$/, // Admin seeding endpoint with secret-based auth
];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, origin } = request.nextUrl;
  const method = request.method;
  if (process.env.TENANT_ENFORCEMENT === 'true' && pathname.startsWith('/api/')) {
    if (!isMvpApiAllowed(pathname, method)) {
      return applySecurityToResponse(request, NextResponse.json({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'הפעולה אינה זמינה בגרסה זו' } }, { status: 404 }));
    }
  }
  // Pages of modules frozen for the MVP. Their APIs are closed above, so the pages would only
  // render errors; old links and bookmarks land on the order list instead.
  if (process.env.TENANT_ENFORCEMENT === 'true' && method === 'GET') {
    const frozenPages = [
      /^\/dashboard(?:\/|$)/,
      /^\/deliveries(?:\/|$)/,
      /^\/orders\/(calendar|map|kanban|deliveries|overview|status)(?:\/|$)/,
      /^\/(inventory|notifications|finance|management|tasks|purchasing|purchase-orders)(?:\/|$)/,
      /^\/settings\/(notifications|templates|announcements)(?:\/|$)/,
    ];
    if (frozenPages.some((pattern) => pattern.test(pathname))) {
      return applySecurityToResponse(request, NextResponse.redirect(new URL('/orders', request.url)));
    }
  }
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();
  const debugMiddleware =
    process.env.DEBUG_MIDDLEWARE === 'true' && process.env.NODE_ENV !== 'production';
  if (debugMiddleware) {
    console.debug(
      `[Middleware] Request to ${pathname}. Method: ${method}. Cookie: ${!!request.cookies.get('ordex.sid')}`
    );
  }

  // Apply security middleware first
  const securityResponse = securityMiddleware(request);
  if (securityResponse) {
    return applySecurityToResponse(request, securityResponse);
  }

  // Note: Demo mode is now handled in the auth core (verifySession)
  // This ensures consistent behavior across middleware and API routes
  const headers = new Headers(request.headers);
  headers.set('x-correlation-id', correlationId);
  if (isDemo()) {
    headers.set('x-demo-mode', 'true');
  }

  // Check if this is a public API endpoint
  const publicPatterns = process.env.TENANT_ENFORCEMENT === 'true'
    ? [/^\/api\/health$/, /^\/api\/auth\/(login|logout)$/, /^\/api\/invitations\/accept$/, /^\/api\/webhooks\/woocommerce\/[^/]+$/]
    : PUBLIC_API_PATHS;
  const isPublicApi = publicPatterns.some((pattern) => pattern.test(pathname));

  // Check if this is a protected path or write operation
  const isProtectedPath = PROTECTED_PATHS.some((pattern) => pattern.test(pathname));
  const isWriteOperation = WRITE_METHODS.includes(method) && pathname.startsWith('/api/');
  const needsAuth = (isProtectedPath || isWriteOperation || (process.env.TENANT_ENFORCEMENT === 'true' && pathname.startsWith('/api/'))) && !isPublicApi;

  // For public endpoints, apply security headers but continue without auth check
  if (!needsAuth) {
    const response = NextResponse.next({ request: { headers } });
    return applySecurityToResponse(request, response);
  }

  // Check for authentication token
  const sessionCookie = getSessionCookie(request);
  const fallbackBlock = request.cookies.get('ordex.nofallback')?.value === '1';
  const authHeader = request.headers.get('authorization');
  const token = sessionCookie || authHeader?.replace('Bearer ', '');

  // In demo mode, allow requests through even without a token
  // The auth core (verifySession) will provide a demo admin user
  if (!token && !isDemo()) {
    if (fallbackBlock) {
      if (debugMiddleware) {
        console.debug('[Middleware] Fallback blocked via cookie, forcing login redirect.');
      }
    }
    // Log security event
    logSecurityEvent(request, {
      type: 'unauthorized_access',
      url: pathname,
      details: { reason: 'missing_auth_token', method },
    });

    // For API routes, return 401 JSON response
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            message:
              'Authentication required. Please provide a valid session token or Bearer token.',
            code: 'UNAUTHORIZED',
            path: pathname,
          },
        },
        { status: 401 }
      );
      return applySecurityToResponse(request, response);
    }

    // For UI routes, redirect to login with return URL
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('returnTo', pathname);
    const response = NextResponse.redirect(loginUrl);
    return applySecurityToResponse(request, response);
  }

  // Edge-friendly: don't verify JWT here (Node-only libs like jsonwebtoken aren't supported in Edge).
  // Presence of a token (or demo mode) allows the request to pass;
  // API routes perform full verification server-side via verifySession.
  const response = NextResponse.next({ request: { headers } });
  return applySecurityToResponse(request, response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - verification (frontend verification pages)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|verification/).*)',
  ],
};
