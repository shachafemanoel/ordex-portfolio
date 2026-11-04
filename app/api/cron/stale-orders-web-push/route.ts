/**
 * GET /api/cron/stale-orders-web-push
 * Sends one Web Push digest to ADMIN/OPERATIONS if open orders exceed SLA (48h by createdAt).
 * Schedule from your host (e.g. daily): Authorization: Bearer <CRON_SIGNATURE_SECRET>
 */

import { getPrismaClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { fetchStaleOrdersSlaSummary } from '@/lib/orders/staleOrderSla';
import { notifyStaleOrdersDigestWebPush } from '@/lib/push/webPush';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SIGNATURE_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const header = req.headers.get('x-cron-secret')?.trim();
  return bearer === secret || header === secret;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prisma = getPrismaClient();
    const now = new Date();
    const { count, oldest } = await fetchStaleOrdersSlaSummary(prisma, now);

    if (count === 0) {
      return NextResponse.json({
        ok: true,
        sent: false,
        count: 0,
        message: 'No stale orders over SLA',
      });
    }

    await notifyStaleOrdersDigestWebPush({
      count,
      oldestOrderNumber: oldest?.number,
      oldestOrderId: oldest?.id,
      now,
    });

    logger.info('stale_orders_web_push_digest', { count, oldestId: oldest?.id });

    return NextResponse.json({
      ok: true,
      sent: true,
      count,
      oldestOrderId: oldest?.id ?? null,
    });
  } catch (e) {
    logger.error('stale_orders_web_push_cron_failed', e instanceof Error ? e : new Error(String(e)));
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
