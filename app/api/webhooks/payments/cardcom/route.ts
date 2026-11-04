import {
  logIsraeliWebhookEvent,
  parseCardcomWebhookPayload,
  verifyCardcomWebhookSignature,
} from '@/lib/payments/israeliPaymentProviders';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Cardcom (or compatible) payment webhook — verify HMAC then acknowledge.
 * Set CARDCOM_WEBHOOK_SECRET and send the same digest in X-Cardcom-Signature (configurable per PSP).
 * Next step: map payload to Payment / order status updates.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature =
    req.headers.get('x-cardcom-signature') ??
    req.headers.get('x-webhook-signature') ??
    req.headers.get('x-signature');

  if (!verifyCardcomWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
  }

  const payload = parseCardcomWebhookPayload(raw);
  logIsraeliWebhookEvent('cardcom', payload);

  return NextResponse.json({ ok: true });
}
