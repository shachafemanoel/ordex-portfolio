import { isTenantRuntime, withTenantContext } from '@/lib/tenancy/context';
import { AuthenticationError as TenantAuthenticationError } from '@/lib/auth/errors';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { logger } from '@/lib/logger';
import { extractCorrelationId } from '@/lib/middleware/correlation-id';

// Standard API Response Types
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
  };
  timestamp: string;
  path: string;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Error Classes
export class ApiError extends Error {
  constructor(
    public code: string,
    public override message: string,
    public statusCode: number = 500,
    public details?: any,
    public field?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any, field?: string) {
    super('VALIDATION_ERROR', message, 400, details, field);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: any) {
    super('CONFLICT', message, 409, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class RateLimitError extends ApiError {
  constructor() {
    super('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', 429);
  }
}

// Error Handler Utility
export function handleApiError(error: unknown, request: NextRequest): NextResponse {
  const correlationId = extractCorrelationId(request);
  if (error instanceof TenantAuthenticationError) return createErrorResponse('Unauthorized', 401);
  const mapped = mapErrorToResponse(error);
  if (mapped) {
    // Add correlation ID to mapped response
    mapped.headers.set('x-correlation-id', correlationId);
    return mapped;
  }

  if (error instanceof ApiError) {
    logger.error('API Error', error, {
      code: error.code,
      statusCode: error.statusCode,
      path: request.url,
      details: error.details,
    });

    const response = NextResponse.json(
      {
        ok: false,
        error: error.code ? String(error.code).toLowerCase() : 'internal_error',
        detail: error.details ?? error.message,
        success: false,
      },
      { status: error.statusCode }
    );
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }

  if (error instanceof ZodError) {
    logger.warn('Validation Error', {
      path: request.url,
      issues: error.issues,
    });

    const response = NextResponse.json(
      {
        ok: false,
        error: 'validation_error',
        detail: error.issues,
        success: false,
      },
      { status: 400 }
    );
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }

  logger.error('Unhandled API Error', error, {
    path: request.url,
    errorType: error instanceof Error ? error.constructor.name : typeof error,
  });

  const response = asInternal();
  response.headers.set('x-correlation-id', correlationId);
  return response;
}

// Success Response Utility (Legacy - includes success flag)
export function createSuccessResponse<T>(
  data: T,
  meta?: ApiSuccessResponse['meta'],
  message?: string,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
    ...(message && { message }),
  };

  return NextResponse.json(response, { status });
}

// Error Response Utility (Legacy - includes success flag)
export function createErrorResponse(
  message: string,
  status: number = 500,
  details?: any,
  field?: string
): NextResponse<ApiErrorResponse> {
  // Derive error code from status
  const codeMap: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    500: 'INTERNAL_ERROR',
  };
  const code = codeMap[status] || 'ERROR';

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(field && { field }),
    },
    timestamp: new Date().toISOString(),
    path: 'n/a',
  };

  return NextResponse.json(response, { status });
}

// Canonical API Response Utilities (Phase 1 Alignment)
import type { ApiResponseEnvelope, PaginatedResponseEnvelope, PaginationMeta } from '@/lib/types';

/**
 * Create a canonical single-resource response: { data: T }
 * Use this for GET /resource/:id, POST /resource, PATCH /resource/:id
 *
 * @param data - response data
 * @param req - optional request object for correlation ID
 */
export function createDataResponse<T>(
  data: T,
  req?: NextRequest
): NextResponse<ApiResponseEnvelope<T>> {
  const response = NextResponse.json({ data });

  if (req) {
    const correlationId = extractCorrelationId(req);
    response.headers.set('x-correlation-id', correlationId);
  }

  return response;
}

/**
 * Create a canonical paginated response: { data: T[], pagination: {...} }
 * Use this for GET /resource (list endpoints)
 *
 * @param data - array of items
 * @param pagination - pagination metadata
 * @param req - optional request object for correlation ID
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  req?: NextRequest
): NextResponse<PaginatedResponseEnvelope<T>> {
  const response = NextResponse.json({ data, pagination });

  if (req) {
    const correlationId = extractCorrelationId(req);
    response.headers.set('x-correlation-id', correlationId);
  }

  return response;
}

// Async Handler Wrapper
export function withErrorHandler(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      // Next.js 15: params is a Promise. Await it if it exists in the context (last arg).
      const context = args[args.length - 1];
      if (context && context.params && typeof context.params.then === 'function') {
        const resolvedParams = await context.params;
        args[args.length - 1] = { ...context, params: resolvedParams };
      }

      if (isTenantRuntime() && !/^\/api\/(health|auth|webhooks)(?:\/|$)/.test(req.nextUrl.pathname)) {
        const { verifySessionFromRequest } = await import('@/lib/auth/verifySession');
        const { user } = await verifySessionFromRequest(req);
        if (!user.tenantId) throw new TenantAuthenticationError('Business session required');
        return await withTenantContext({ tenantId: user.tenantId, userId: user.id, role: user.role === 'ADMIN' ? 'ADMIN' : 'OPERATIONS' }, () => handler(req, ...args));
      }
      return await handler(req, ...args);
    } catch (error) {
      return handleApiError(error, req);
    }
  };
}

// Compatibility shims for older routes
// Note: Some route handlers call withApiErrorHandling(() => { ... }) without passing req.
// Provide a simple wrapper that catches errors and returns a JSON ApiErrorResponse.
export async function withApiErrorHandling<T = any>(
  handler: () => Promise<T | NextResponse>
): Promise<NextResponse> {
  try {
    const result = await handler();
    if (result instanceof NextResponse) return result;
    return NextResponse.json({ success: true, data: result } as any);
  } catch (error) {
    // Fallback without a real NextRequest; construct a minimal error response
    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'An unknown error occurred';
    let details: any = undefined;
    let field: string | undefined = undefined;

    if (error instanceof ApiError) {
      statusCode = error.statusCode;
      code = error.code;
      message = error.message;
      details = error.details;
      field = error.field;
    } else if (error instanceof ZodError) {
      statusCode = 400;
      code = 'VALIDATION_ERROR';
      message = error.errors?.[0]?.message || 'Validation failed';
      details = error.errors;
    } else if (error instanceof Error) {
      message = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        error: { code, message, details, field },
        timestamp: new Date().toISOString(),
        path: 'n/a',
      },
      { status: statusCode }
    );
  }
}

// Alias for compatibility with older imports
export const apiErrorHandler = handleApiError;

// Request Validation Middleware
export function validateRequest<T>(schema: any) {
  return async (req: NextRequest): Promise<T> => {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      throw new ZodError(result.error.issues);
    }

    return result.data;
  };
}

// RBAC Types and Interfaces - Re-exported from auth service
export type { UserRole } from '@prisma/client';
export { requirePermissions } from '@/lib/auth/permissions';
export { requireRole } from '@/lib/auth/requireRole';
export type { AuthenticatedUser, Permission } from '@/lib/auth/types';
export { withAuth } from '@/lib/auth/withAuthRoute';

// Rate Limiting Utilities
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

export function getRateLimitIdentifier(req: NextRequest, user?: AuthenticatedUser): string {
  // Use user ID for authenticated requests, IP for unauthenticated
  if (user) {
    return `user:${user.id}`;
  }

  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

// CORS Middleware
export function setCorsHeaders(response: NextResponse): NextResponse {
  const defaultOrigins = process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000'];
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || defaultOrigins;

  response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

// Re-export correlation ID utilities
export { extractCorrelationId, withCorrelationId } from '@/lib/middleware/correlation-id';
