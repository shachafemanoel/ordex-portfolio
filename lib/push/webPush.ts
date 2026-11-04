import { isTenantRuntime } from '@/lib/tenancy/context';
import { getPrismaClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { UserRole } from '@prisma/client';

let configured = false;

function ensureVapid(webpush: typeof import('web-push')) {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:ops@ordex.app';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function isWebPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Notify active ADMIN / OPERATIONS users who registered a browser subscription.
 */
export async function notifyOperationsWebPush(payload: PushPayload): Promise<void> {
  if (isTenantRuntime()) return;
  if (!isWebPushConfigured()) {
    return;
  }

  let webpush: typeof import('web-push');
  try {
    webpush = await import('web-push');
  } catch (e) {
    logger.warn('web-push package not available', { error: e instanceof Error ? e.message : String(e) });
    return;
  }

  if (!ensureVapid(webpush)) {
    return;
  }

  const prisma = getPrismaClient();
  const subs = await prisma.pushSubscription.findMany({
    where: {
      user: {
        isActive: true,
        role: { in: [UserRole.ADMIN, UserRole.OPERATIONS] },
      },
    },
  });

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/orders',
    tag: payload.tag ?? 'ordex-ops',
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 60 * 60 }
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        }
        logger.warn('Web push send failed', { subscriptionId: s.id, status, err });
      }
    })
  );
}

export async function notifyNewOrderWebPush(input: {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
}): Promise<void> {
  await notifyOperationsWebPush({
    title: 'הזמנה חדשה',
    body: `${input.orderNumber}${input.customerName ? ` · ${input.customerName}` : ''}`,
    url: `/orders/${input.orderId}`,
    tag: `order-${input.orderId}`,
  });
}

export async function notifyPaymentReceivedWebPush(input: {
  orderId: string;
  orderNumber: string;
  amountCents: number;
}): Promise<void> {
  const amountLabel = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(input.amountCents / 100);

  await notifyOperationsWebPush({
    title: 'תשלום התקבל',
    body: `${input.orderNumber} · ${amountLabel}`,
    url: `/orders/${input.orderId}`,
    tag: `payment-${input.orderId}-${input.amountCents}`,
  });
}

/**
 * Digest when orders sit open past SLA (see staleOrderSlaWhere).
 * Uses a calendar-day tag so repeated cron runs the same day replace the same notification.
 */
export async function notifyStaleOrdersDigestWebPush(input: {
  count: number;
  oldestOrderNumber?: string;
  oldestOrderId?: string;
  now?: Date;
}): Promise<void> {
  if (input.count <= 0) {
    return;
  }

  const now = input.now ?? new Date();
  const dayKey = now.toISOString().slice(0, 10);

  const body =
    input.count === 1 && input.oldestOrderNumber
      ? `הזמנה ${input.oldestOrderNumber} פתוחה מעל 48 שעות`
      : `${input.count} הזמנות פתוחות מעל 48 שעות — נדרש מעקב`;

  await notifyOperationsWebPush({
    title: 'הזמנות תקועות (SLA)',
    body,
    url: input.oldestOrderId ? `/orders/${input.oldestOrderId}` : '/orders',
    tag: `ordex-stale-sla-${dayKey}`,
  });
}
