import { z } from 'zod';
import { prisma, withIdentityDatabase } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withTenantContext } from '@/lib/tenancy/context';
import { validateWebhookSignature } from '@/lib/webhook-security';
import { openCredentials } from './credentials';
import { ORDER_TOPICS } from './store-client';

export const MAX_WEBHOOK_BYTES = 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OrderEvent = z.object({
  id: z.number().int().positive(),
  status: z.string(),
  date_modified_gmt: z.string().nullish(),
  date_created_gmt: z.string().nullish(),
});

export type ReceiveOutcome =
  | 'ping'
  | 'stored'
  | 'duplicate'
  | 'ignored_topic'
  | 'unknown_integration'
  | 'bad_signature'
  | 'bad_payload';

export interface ReceiveResult {
  status: number;
  outcome: ReceiveOutcome;
}

interface Delivery {
  integrationId: string;
  headers: Headers;
  rawBody: Buffer;
}

/** WooCommerce posts `webhook_id=<n>` once when a webhook is created or re-enabled. */
function isPing(headers: Headers, rawBody: Buffer): boolean {
  return (headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded') && /^webhook_id=\d+$/.test(rawBody.toString('utf8').trim());
}

/**
 * Receives one store event. It only verifies and stores: answering fast matters because the store
 * disables a webhook after five failed or slow deliveries in a row. Turning events into orders is a
 * separate, retryable step that reads the queued jobs.
 *
 * Deduplication uses the order and its modification time: the delivery ID header is a log entry
 * ID, not a stable key, and deliveries can arrive late or out of order.
 */
export async function receiveStoreEvent({ integrationId, headers, rawBody }: Delivery): Promise<ReceiveResult> {
  if (isPing(headers, rawBody)) return { status: 200, outcome: 'ping' };
  if (!UUID.test(integrationId)) return { status: 404, outcome: 'unknown_integration' };

  const integration = await withIdentityDatabase((db) =>
    db.wooIntegration.findUnique({
      where: { id: integrationId },
      select: { id: true, tenantId: true, credentials: true, status: true, enabled: true, serviceUserId: true },
    })
  );
  const credentials = integration?.enabled && integration.status !== 'DISABLED' ? openCredentials(integration.credentials) : null;
  if (!integration || !credentials || !integration.serviceUserId) return { status: 404, outcome: 'unknown_integration' };

  const signature = headers.get('x-wc-webhook-signature') ?? '';
  if (!validateWebhookSignature('woocommerce', rawBody, signature, credentials.webhookSecret)) {
    return { status: 401, outcome: 'bad_signature' };
  }

  const topic = headers.get('x-wc-webhook-topic') ?? '';
  if (!(ORDER_TOPICS as readonly string[]).includes(topic)) return { status: 200, outcome: 'ignored_topic' };

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return { status: 400, outcome: 'bad_payload' };
  }
  const event = OrderEvent.safeParse(payload);
  if (!event.success) return { status: 400, outcome: 'bad_payload' };

  const orderId = String(event.data.id);
  const version = event.data.date_modified_gmt || event.data.date_created_gmt || '';
  const dedupKey = `order:${orderId}:${version}`;
  const rawPayload = JSON.stringify(payload);

  const inserted = await withTenantContext(
    { tenantId: integration.tenantId, userId: integration.serviceUserId, role: 'OPERATIONS' },
    () =>
      prisma.$transaction(async (tx) => {
        // Keep only the newest version of the order: a late, older delivery must not overwrite it.
        await tx.$executeRaw`
          INSERT INTO inbound_orders (id, source, source_order_id, raw_payload, updated_at)
          VALUES (gen_random_uuid(), 'WOOCOMMERCE', ${orderId}, ${rawPayload}::jsonb, now())
          ON CONFLICT (tenant_id, source, source_order_id) DO UPDATE
            SET raw_payload = EXCLUDED.raw_payload, updated_at = now()
            WHERE coalesce(inbound_orders.raw_payload->>'date_modified_gmt', inbound_orders.raw_payload->>'date_created_gmt', '')
                < coalesce(EXCLUDED.raw_payload->>'date_modified_gmt', EXCLUDED.raw_payload->>'date_created_gmt', '')`;
        const jobs = await tx.$executeRaw`
          INSERT INTO woo_sync_jobs (id, integration_id, kind, object_id, topic, dedup_key)
          VALUES (gen_random_uuid(), ${integration.id}::uuid, 'ORDER_EVENT', ${orderId}, ${topic}, ${dedupKey})
          ON CONFLICT (tenant_id, integration_id, dedup_key) DO NOTHING`;
        await tx.wooIntegration.update({ where: { id: integration.id }, data: { lastEventAt: new Date() } });
        return jobs > 0;
      })
  );

  return { status: 200, outcome: inserted ? 'stored' : 'duplicate' };
}

/** One structured line per delivery, without customer data. */
export function logDelivery(integrationId: string, topic: string | null, result: ReceiveResult, durationMs: number) {
  const level = result.status >= 400 ? 'warn' : 'info';
  logger[level]('woocommerce.webhook', { integrationId, topic, outcome: result.outcome, status: result.status, durationMs });
}
