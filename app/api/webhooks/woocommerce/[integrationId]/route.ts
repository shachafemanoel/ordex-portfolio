import { logDelivery, MAX_WEBHOOK_BYTES, receiveStoreEvent } from '@/lib/integrations/woocommerce/receiver';
import { webhookRateLimit } from '@/lib/rate-limit';
import { logSecurityEvent } from '@/lib/security-middleware';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const reply = (status: number, outcome: string) => NextResponse.json({ received: status < 300, outcome }, { status });

/** Order events from a connected WooCommerce store. Public: authenticated by the per-store HMAC signature. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ integrationId: string }> }) {
  const startedAt = Date.now();
  const { integrationId } = await params;
  const topic = req.headers.get('x-wc-webhook-topic');

  const limited = await webhookRateLimit.middleware(req);
  if (limited) return limited;

  if (Number(req.headers.get('content-length') ?? 0) > MAX_WEBHOOK_BYTES) return reply(413, 'too_large');
  const rawBody = Buffer.from(await req.arrayBuffer());
  if (rawBody.length > MAX_WEBHOOK_BYTES) return reply(413, 'too_large');

  const result = await receiveStoreEvent({ integrationId, headers: req.headers, rawBody });
  logDelivery(integrationId, topic, result, Date.now() - startedAt);
  if (result.outcome === 'bad_signature') {
    logSecurityEvent(req, { type: 'webhook_validation_failed', url: req.nextUrl.pathname, details: { provider: 'woocommerce', integrationId } });
  }
  return reply(result.status, result.outcome);
}
