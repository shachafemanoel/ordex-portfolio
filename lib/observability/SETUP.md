# OpenTelemetry Setup Guide

This guide explains how to enable OpenTelemetry instrumentation in the Ordex OMS.

## Installation

Install the required OpenTelemetry packages:

```bash
npm install @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http \
  @opentelemetry/instrumentation-http \
  @opentelemetry/instrumentation-express \
  @opentelemetry/instrumentation-prisma \
  @opentelemetry/sdk-metrics \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics

# Optional: Custom headers for authentication
# OTEL_EXPORTER_OTLP_HEADERS='{"Authorization":"Bearer YOUR_TOKEN"}'
```

### Jaeger (Local Development)

For local development with Jaeger:

```bash
# Run Jaeger using Docker
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest

# Access Jaeger UI at http://localhost:16686
```

### Grafana Cloud (Production)

For production with Grafana Cloud:

1. Create a Grafana Cloud account
2. Get your OTLP endpoint and API key
3. Set environment variables:

```bash
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net/otlp/v1/traces
OTEL_EXPORTER_OTLP_HEADERS='{"Authorization":"Basic YOUR_BASE64_ENCODED_KEY"}'
```

## Application Setup

### 1. Initialize Telemetry at Startup

In your `instrumentation.ts` or main entry point:

```typescript
// instrumentation.ts (Next.js 13+ instrumentation hook)
import { initializeTelemetry } from '@/lib/observability';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await initializeTelemetry();
  }
}
```

Or in your Next.js middleware:

```typescript
// middleware.ts
import { initializeTelemetry } from '@/lib/observability';

// Initialize once at module load
let telemetryInitialized = false;

export async function middleware(req: NextRequest) {
  if (!telemetryInitialized) {
    await initializeTelemetry();
    telemetryInitialized = true;
  }

  // ... rest of middleware
}
```

### 2. Instrument Prisma Client

Update your Prisma client initialization:

```typescript
// lib/db.ts
import { instrumentPrisma } from '@/lib/observability';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Instrument Prisma for OpenTelemetry
instrumentPrisma(prisma);

export default prisma;
```

### 3. Instrument API Routes

Wrap your API route handlers:

```typescript
// app/api/orders/route.ts
import { withHttpInstrumentation } from '@/lib/observability';
import { withAuth } from '@/lib/api-middleware';

export const GET = withAuth(
  withHttpInstrumentation(async (req: NextRequest, user: AuthenticatedUser) => {
    // Your handler logic
    const orders = await prisma.order.findMany();
    return createDataResponse(orders, req);
  })
);
```

### 4. Instrument Business Operations

For custom business logic instrumentation:

```typescript
import { instrumentOperation, setSpanAttributes, SpanAttributes } from '@/lib/observability';

export async function processOrder(orderId: string) {
  return await instrumentOperation(
    'processOrder',
    async () => {
      // Set custom attributes
      setSpanAttributes({
        [SpanAttributes.ORDER_ID]: orderId,
        'operation.type': 'order_processing',
      });

      // Your business logic
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      // ... process order

      return order;
    },
    { [SpanAttributes.ORDER_ID]: orderId }
  );
}
```

### 5. Instrument External API Calls

For WooCommerce, Google Calendar, Twilio, etc.:

```typescript
import { instrumentExternalCall } from '@/lib/observability';

export async function syncWithWooCommerce(orderId: string) {
  return await instrumentExternalCall(
    'woocommerce',
    'sync_order',
    async () => {
      const response = await fetch(`${WOO_BASE_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${WOO_TOKEN}` },
      });
      return await response.json();
    }
  );
}
```

## Usage Examples

### Complete API Route Example

```typescript
import { NextRequest } from 'next/server';
import {
  withHttpInstrumentation,
  instrumentTransaction,
  setSpanAttributes,
  SpanAttributes,
} from '@/lib/observability';
import { withAuth, createDataResponse } from '@/lib/api-middleware';
import prisma from '@/lib/db';

export const POST = withAuth(
  withHttpInstrumentation(async (req: NextRequest, user: AuthenticatedUser) => {
    const data = await req.json();

    // Instrument transaction
    const order = await instrumentTransaction('createOrder', async () => {
      // Set business context
      setSpanAttributes({
        [SpanAttributes.USER_ID]: user.id,
        [SpanAttributes.ORDER_STATUS]: 'DRAFT',
        'order.total_cents': data.totalCents,
      });

      // Create order in transaction
      const newOrder = await prisma.order.create({
        data: {
          ...data,
          createdBy: user.id,
        },
      });

      // Additional operations
      await createAuditLog(newOrder.id, 'ORDER_CREATED', user.id);

      return newOrder;
    });

    return createDataResponse(order, req);
  })
);
```

## Viewing Traces

### Jaeger UI

1. Open http://localhost:16686
2. Select "ordex-oms" from the service dropdown
3. Click "Find Traces"
4. View distributed traces with timing information

### Grafana Cloud

1. Log into your Grafana Cloud account
2. Navigate to "Explore" → "Tempo"
3. Query for service "ordex-oms"
4. View traces with full context

## Performance Monitoring

The instrumentation automatically tracks:

- **HTTP Requests**: Method, route, status code, duration
- **Database Queries**: Model, operation, duration, slow query detection
- **External API Calls**: Service, operation, success/failure, duration
- **Business Operations**: Custom operations with context
- **Errors**: Automatic error recording with stack traces

## Slow Query Detection

Automatic alerts for slow database queries:

- **Warning**: Queries > 1 second
- **Critical**: Queries > 5 seconds

Check logs and spans for slow query events.

## Disabling Telemetry

Telemetry is automatically disabled:

- When OpenTelemetry packages are not installed
- During build processes (DOCKER_BUILD=true, CI=true, RAILWAY_BUILD=true)
- When OTEL endpoints are not configured

The system gracefully falls back to normal operation without telemetry.

## Best Practices

1. **Use correlation IDs**: Automatically added to all traces
2. **Add business context**: Use `setSpanAttributes()` for domain-specific data
3. **Monitor slow queries**: Review spans with query duration > 1s
4. **Instrument critical paths**: Focus on order processing, payments, integrations
5. **Regular review**: Check traces weekly for performance bottlenecks

## Troubleshooting

### Traces not appearing

1. Check OpenTelemetry packages are installed
2. Verify OTEL_EXPORTER endpoints are correct
3. Check Jaeger/Grafana is running
4. Look for telemetry initialization logs
5. Ensure `initializeTelemetry()` is called before any requests

### High overhead

1. Reduce sampling rate (default: 100%)
2. Disable filesystem instrumentation (already done)
3. Increase metric export interval
4. Review slow query thresholds

## Additional Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Grafana Cloud Traces](https://grafana.com/docs/grafana-cloud/traces/)
