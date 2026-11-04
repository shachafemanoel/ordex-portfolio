import {
  createDataResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { getPrismaClient } from '@/lib/db';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const BodySchema = z.object({
  endpoint: z.string().url(),
});

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  const data = (await validateRequest(BodySchema)(req)) as z.infer<typeof BodySchema>;

  const prisma = getPrismaClient();
  await prisma.pushSubscription.deleteMany({
    where: { userId: user.id, endpoint: data.endpoint },
  });

  return createDataResponse({ ok: true }, req);
});
