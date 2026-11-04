/**
 * OpenTelemetry Instrumentation
 *
 * Provides distributed tracing and metrics collection for the Ordex OMS.
 * Integrates with Jaeger, Grafana, or any OTLP-compatible backend.
 *
 * @module lib/observability/telemetry
 *
 * Required packages (run: npm install):
 * - @opentelemetry/api
 * - @opentelemetry/sdk-node
 * - @opentelemetry/auto-instrumentations-node
 * - @opentelemetry/exporter-trace-otlp-http
 * - @opentelemetry/exporter-metrics-otlp-http
 * - @opentelemetry/instrumentation-http
 * - @opentelemetry/instrumentation-express
 * - @opentelemetry/instrumentation-prisma
 */

import { logger } from '@/lib/logger';

// Type-safe dynamic imports for OpenTelemetry (optional dependencies)
type TraceAPI = any;
type SpanAPI = any;
type AttributesAPI = any;

let trace: TraceAPI | null = null;
let isInitialized = false;
let isAvailable = false;

async function optionalImport(moduleName: string): Promise<any> {
  const importer = new Function('m', 'return import(m);') as (m: string) => Promise<any>;
  return importer(moduleName);
}

/**
 * Check if OpenTelemetry is available
 */
export function isTelemetryAvailable(): boolean {
  return isAvailable;
}

/**
 * Initialize OpenTelemetry SDK
 *
 * This should be called once at application startup, before any other code.
 */
export async function initializeTelemetry(): Promise<boolean> {
  if (isInitialized) {
    return isAvailable;
  }

  // Skip in build/CI environments
  if (
    process.env.DOCKER_BUILD === 'true' ||
    process.env.CI === 'true' ||
    process.env.RAILWAY_BUILD
  ) {
    logger.info('Telemetry skipped in build environment');
    isInitialized = true;
    isAvailable = false;
    return false;
  }

  try {
    // Try to load OpenTelemetry packages
    const { trace: otelTrace, SpanStatusCode } = await optionalImport('@opentelemetry/api');
    const { NodeSDK } = await optionalImport('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await optionalImport(
      '@opentelemetry/auto-instrumentations-node'
    );
    const { OTLPTraceExporter } = await optionalImport('@opentelemetry/exporter-trace-otlp-http');
    const { OTLPMetricExporter } = await optionalImport(
      '@opentelemetry/exporter-metrics-otlp-http'
    );
    const { PeriodicExportingMetricReader } = await optionalImport('@opentelemetry/sdk-metrics');
    const { Resource } = await optionalImport('@opentelemetry/resources');
    const { SemanticResourceAttributes } = await optionalImport(
      '@opentelemetry/semantic-conventions'
    );

    // Configure resource attributes
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'ordex-oms',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      })
    );

    // Configure trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    });

    // Configure metrics exporter
    const metricExporter = new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    });

    // Configure metric reader
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 60000, // Export every 60 seconds
    });

    // Initialize SDK
    const sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable filesystem instrumentation (noisy)
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-prisma': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    await sdk.start();

    trace = otelTrace;
    isAvailable = true;
    isInitialized = true;

    logger.info('OpenTelemetry initialized', {
      serviceName: 'ordex-oms',
      traceEndpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
      metricsEndpoint: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      try {
        await sdk.shutdown();
        logger.info('OpenTelemetry shut down gracefully');
      } catch (error) {
        logger.error('Error shutting down OpenTelemetry', error);
      }
    });

    return true;
  } catch (error) {
    logger.info('OpenTelemetry not available - packages not installed', {
      hint: 'Run: npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node',
    });
    isInitialized = true;
    isAvailable = false;
    return false;
  }
}

/**
 * Get the active tracer
 */
export function getTracer(): TraceAPI | null {
  if (!isAvailable || !trace) {
    return null;
  }

  try {
    return trace.getTracer('ordex-oms', process.env.npm_package_version || '1.0.0');
  } catch (error) {
    logger.warn('Failed to get tracer', { error });
    return null;
  }
}

/**
 * Create a new span for instrumentation
 *
 * @param name - span name
 * @param fn - function to instrument
 * @param attributes - optional span attributes
 */
export async function withSpan<T>(
  name: string,
  fn: (span: SpanAPI | null) => Promise<T>,
  attributes?: AttributesAPI
): Promise<T> {
  if (!isAvailable) {
    return await fn(null);
  }

  const tracer = getTracer();
  if (!tracer) {
    return await fn(null);
  }

  try {
    return await tracer.startActiveSpan(name, { attributes }, async (span: SpanAPI) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({
          code: 2, // ERROR
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  } catch (error) {
    logger.error('Span creation failed', error, { spanName: name });
    return await fn(null);
  }
}

/**
 * Add attributes to the current active span
 *
 * @param attributes - attributes to add
 */
export function setSpanAttributes(attributes: AttributesAPI): void {
  if (!isAvailable || !trace) {
    return;
  }

  try {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  } catch (error) {
    logger.warn('Failed to set span attributes', { error });
  }
}

/**
 * Add an event to the current active span
 *
 * @param name - event name
 * @param attributes - optional event attributes
 */
export function addSpanEvent(name: string, attributes?: AttributesAPI): void {
  if (!isAvailable || !trace) {
    return;
  }

  try {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  } catch (error) {
    logger.warn('Failed to add span event', { error });
  }
}

/**
 * Record an exception in the current active span
 *
 * @param error - error to record
 */
export function recordException(error: Error | unknown): void {
  if (!isAvailable || !trace) {
    return;
  }

  try {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error as Error);
      span.setStatus({
        code: 2, // ERROR
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (err) {
    logger.warn('Failed to record exception', { error: err });
  }
}

/**
 * Semantic conventions for common span attributes
 */
export const SpanAttributes = {
  // HTTP
  HTTP_METHOD: 'http.method',
  HTTP_URL: 'http.url',
  HTTP_STATUS_CODE: 'http.status_code',
  HTTP_ROUTE: 'http.route',

  // Database
  DB_SYSTEM: 'db.system',
  DB_NAME: 'db.name',
  DB_OPERATION: 'db.operation',
  DB_STATEMENT: 'db.statement',

  // Business
  ORDER_ID: 'order.id',
  ORDER_STATUS: 'order.status',
  CUSTOMER_ID: 'customer.id',
  USER_ID: 'user.id',

  // Performance
  CACHE_HIT: 'cache.hit',
  QUERY_DURATION_MS: 'query.duration_ms',
} as const;
