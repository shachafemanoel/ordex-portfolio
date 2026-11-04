/**
 * HTTP Instrumentation Middleware
 *
 * Automatically instruments HTTP requests with OpenTelemetry tracing
 *
 * @module lib/observability/http-instrumentation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSpan, setSpanAttributes, SpanAttributes, isTelemetryAvailable } from '@/lib/observability/telemetry';
import { extractCorrelationId } from '@/lib/middleware/correlation-id';
import { logger } from '@/lib/logger';

/**
 * Extract route pattern from Next.js request
 *
 * @param req - NextRequest object
 * @returns route pattern (e.g., /api/orders/[id])
 */
function extractRoutePattern(req: NextRequest): string {
  const url = new URL(req.url);
  let path = url.pathname;

  // Replace UUIDs with [id] placeholder
  path = path.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/[id]'
  );

  // Replace numeric IDs with [id] placeholder
  path = path.replace(/\/\d+/g, '/[id]');

  return path;
}

/**
 * HTTP instrumentation middleware wrapper
 *
 * Wraps an API route handler with OpenTelemetry tracing
 *
 * @param handler - API route handler
 * @returns wrapped handler with telemetry
 */
export function withHttpInstrumentation<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    if (!isTelemetryAvailable()) {
      // Telemetry not available - call handler directly
      return await handler(req, ...args);
    }

    const method = req.method;
    const url = new URL(req.url);
    const route = extractRoutePattern(req);
    const correlationId = extractCorrelationId(req);

    return await withSpan(
      `HTTP ${method} ${route}`,
      async (span) => {
        const startTime = Date.now();

        try {
          // Set span attributes
          if (span) {
            setSpanAttributes({
              [SpanAttributes.HTTP_METHOD]: method,
              [SpanAttributes.HTTP_URL]: url.pathname,
              [SpanAttributes.HTTP_ROUTE]: route,
              'correlation.id': correlationId,
              'http.host': url.host,
              'http.scheme': url.protocol.replace(':', ''),
            });

            // Add query parameters (if not sensitive)
            const queryParams = Array.from(url.searchParams.entries())
              .filter(([key]) => !['token', 'password', 'secret'].includes(key.toLowerCase()))
              .map(([key, value]) => `${key}=${value}`)
              .join('&');

            if (queryParams) {
              setSpanAttributes({ 'http.query': queryParams });
            }
          }

          // Execute handler
          const response = await handler(req, ...args);

          // Record response status
          const duration = Date.now() - startTime;

          if (span) {
            setSpanAttributes({
              [SpanAttributes.HTTP_STATUS_CODE]: response.status,
              'http.response_duration_ms': duration,
            });
          }

          logger.info('HTTP Request', {
            method,
            route,
            status: response.status,
            duration,
            correlationId,
          });

          return response;
        } catch (error) {
          const duration = Date.now() - startTime;

          logger.error('HTTP Request Failed', error, {
            method,
            route,
            duration,
            correlationId,
          });

          throw error;
        }
      },
      {
        'span.kind': 'server',
        'component': 'http',
      }
    );
  };
}

/**
 * Instrument external HTTP calls (e.g., to WooCommerce, Google Calendar, etc.)
 *
 * @param serviceName - name of external service
 * @param operation - operation being performed
 * @param fn - function making the HTTP call
 */
export async function instrumentExternalCall<T>(
  serviceName: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!isTelemetryAvailable()) {
    return await fn();
  }

  return await withSpan(
    `${serviceName}.${operation}`,
    async (span) => {
      const startTime = Date.now();

      try {
        if (span) {
          setSpanAttributes({
            'service.name': serviceName,
            operation,
            'span.kind': 'client',
          });
        }

        const result = await fn();

        const duration = Date.now() - startTime;

        if (span) {
          setSpanAttributes({
            'external.duration_ms': duration,
            'external.success': true,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (span) {
          setSpanAttributes({
            'external.duration_ms': duration,
            'external.success': false,
            'external.error': error instanceof Error ? error.message : String(error),
          });
        }

        throw error;
      }
    },
    {
      'span.kind': 'client',
      'component': 'http-client',
    }
  );
}

/**
 * Instrument business operations
 *
 * @param operationName - name of the business operation
 * @param fn - function implementing the operation
 * @param attributes - optional additional attributes
 */
export async function instrumentOperation<T>(
  operationName: string,
  fn: () => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  if (!isTelemetryAvailable()) {
    return await fn();
  }

  return await withSpan(
    operationName,
    async (span) => {
      const startTime = Date.now();

      try {
        if (span && attributes) {
          setSpanAttributes(attributes);
        }

        const result = await fn();

        const duration = Date.now() - startTime;

        if (span) {
          setSpanAttributes({
            'operation.duration_ms': duration,
            'operation.success': true,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (span) {
          setSpanAttributes({
            'operation.duration_ms': duration,
            'operation.success': false,
          });
        }

        throw error;
      }
    },
    {
      'span.kind': 'internal',
      'component': 'business-logic',
    }
  );
}
