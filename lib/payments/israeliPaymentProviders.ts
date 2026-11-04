/**
 * Israeli payment provider scaffolding (Cardcom, Tranzila, iCredit, etc.)
 * Webhook: `POST /api/webhooks/payments/cardcom` — verify signature and reconcile payments when wired.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

export type IsraeliPaymentProviderId = 'cardcom' | 'tranzila' | 'icredit';

export interface IsraeliPaymentProviderConfig {
  readonly provider: IsraeliPaymentProviderId;
  readonly enabled: boolean;
  readonly merchantIdEnv: string;
  readonly notes?: string;
}

export const ISRAELI_PAYMENT_PROVIDERS_PLACEHOLDER: ReadonlyArray<IsraeliPaymentProviderConfig> = [
  {
    provider: 'cardcom',
    enabled: false,
    merchantIdEnv: 'CARDCOM_TERMINAL_ID',
    notes: 'Webhook secret: CARDCOM_WEBHOOK_SECRET (HMAC of raw body)',
  },
  { provider: 'tranzila', enabled: false, merchantIdEnv: 'TRANZILA_TERMINAL' },
  { provider: 'icredit', enabled: false, merchantIdEnv: 'ICREDIT_MERCHANT' },
];

const PRIMARY_PROVIDER: IsraeliPaymentProviderId = 'cardcom';

/** Which provider is the default for `buildHostedPaymentStartUrl` / docs. */
export function getDefaultIsraeliPaymentProvider(): IsraeliPaymentProviderId {
  return PRIMARY_PROVIDER;
}

/**
 * Returns a placeholder payment URL. Replace with Cardcom Low Profile / Tranzila iframe URL
 * once terminal credentials and return URLs are configured.
 */
export function buildHostedPaymentStartUrl(_args: {
  orderId: string;
  amountCents: number;
  currency: string;
}): { provider: IsraeliPaymentProviderId; url: string } {
  return {
    provider: PRIMARY_PROVIDER,
    url: '/settings?tab=payments&israeli=cardcom',
  };
}

/**
 * Verifies Cardcom-style HMAC-SHA256 hex digest over the raw body.
 * Header name may vary by integration — normalize with your PSP docs.
 */
export function verifyCardcomWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.CARDCOM_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHeader) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signatureHeader.trim(), 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseCardcomWebhookPayload(rawBody: string): Record<string, unknown> {
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { raw: rawBody };
  }
}

export function logIsraeliWebhookEvent(provider: IsraeliPaymentProviderId, payload: unknown): void {
  logger.info('israeli_payment_webhook', { provider, payload });
}
