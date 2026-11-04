import { databaseTenantId } from '@/lib/tenancy/context';
import {
  createDataResponse,
  createErrorResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { getPrismaClient } from '@/lib/db';
import { isWebPushConfigured } from '@/lib/push/webPush';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const BodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  if (!isWebPushConfigured()) {
    return createErrorResponse('Web Push is not configured', 503);
  }

  const data = (await validateRequest(BodySchema)(req)) as z.infer<typeof BodySchema>;

  const prisma = getPrismaClient();
  const ua = req.headers.get('user-agent')?.slice(0, 500) ?? null;

  await prisma.pushSubscription.upsert({
    where: { tenantId_endpoint: { tenantId: await databaseTenantId(), endpoint: data.endpoint } },
    create: {
      userId: user.id,
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      userAgent: ua,
    },
    update: {
      userId: user.id,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      userAgent: ua,
    },
  });

  return createDataResponse({ ok: true }, req);
});
