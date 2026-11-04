/**
 * Correlation ID Middleware
 *
 * Generates or extracts correlation IDs for request tracing across services.
 * Correlation IDs help track requests through the system for debugging and monitoring.
 *
 * @module lib/middleware/correlation-id
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * Header name for correlation ID
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Context storage for correlation ID (in-memory for current request)
 * This allows access to correlation ID from anywhere in the request lifecycle
 */
const correlationIdStorage = new Map<string, string>();

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Extract correlation ID from request or generate a new one
 *
 * @param req - NextRequest object
 * @returns correlation ID string
 */
export function getOrCreateCorrelationId(req: NextRequest): string {
  // Check if correlation ID exists in header
  const existingId = req.headers.get(CORRELATION_ID_HEADER);

  if (existingId) {
    return existingId;
  }

  // Generate new correlation ID
  return generateCorrelationId();
}

/**
 * Store correlation ID in context storage
 *
 * @param correlationId - correlation ID to store
 */
export function setCorrelationId(correlationId: string): void {
  // Use request URL as key (since we don't have a proper async context)
  const key = 'current';
  correlationIdStorage.set(key, correlationId);
}

/**
 * Get correlation ID from context storage
 *
 * @returns correlation ID or 'unknown' if not found
 */
export function getCorrelationId(): string {
  return correlationIdStorage.get('current') || 'unknown';
}

/**
 * Clear correlation ID from context storage
 */
export function clearCorrelationId(): void {
  correlationIdStorage.delete('current');
}

/**
 * Middleware wrapper that adds correlation ID to requests
 *
 * @param handler - API route handler
 * @returns wrapped handler with correlation ID support
 */
export function withCorrelationId<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    // Extract or generate correlation ID
    const correlationId = getOrCreateCorrelationId(req);

    // Store in context
    setCorrelationId(correlationId);

    try {
      // Execute handler
      const response = await handler(req, ...args);

      // Add correlation ID to response headers
      response.headers.set(CORRELATION_ID_HEADER, correlationId);

      return response;
    } finally {
      // Clean up context
      clearCorrelationId();
    }
  };
}

/**
 * Middleware that can be used in middleware.ts for edge runtime
 *
 * @param req - NextRequest object
 * @param next - Next response or function
 * @returns response with correlation ID header
 */
export async function correlationIdMiddleware(
  req: NextRequest
): Promise<NextResponse> {
  const correlationId = getOrCreateCorrelationId(req);

  // Create response (continue to next middleware/handler)
  const response = NextResponse.next();

  // Add correlation ID to response headers
  response.headers.set(CORRELATION_ID_HEADER, correlationId);

  // Also set it in request headers for downstream handlers
  response.headers.set('x-middleware-correlation-id', correlationId);

  return response;
}

/**
 * Extract correlation ID from request for logging
 *
 * @param req - NextRequest object
 * @returns correlation ID or 'unknown'
 */
export function extractCorrelationId(req: NextRequest): string {
  return req.headers.get(CORRELATION_ID_HEADER) ||
         req.headers.get('x-middleware-correlation-id') ||
         'unknown';
}
