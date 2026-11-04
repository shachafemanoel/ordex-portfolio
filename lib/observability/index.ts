/**
 * Observability Module
 *
 * Comprehensive observability infrastructure including OpenTelemetry tracing,
 * HTTP instrumentation, and database query monitoring.
 *
 * @module lib/observability
 */

// Telemetry Core
export {
  initializeTelemetry,
  isTelemetryAvailable,
  getTracer,
  withSpan,
  setSpanAttributes,
  addSpanEvent,
  recordException,
  SpanAttributes,
} from './telemetry';

// HTTP Instrumentation
export {
  withHttpInstrumentation,
  instrumentExternalCall,
  instrumentOperation,
} from './http-instrumentation';

// Database Instrumentation
export {
  instrumentPrisma,
  instrumentTransaction,
  instrumentBatch,
  createInstrumentedPrisma,
} from './database-instrumentation';
