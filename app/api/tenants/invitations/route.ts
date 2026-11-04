import { prisma } from '@/lib/db';
import { tenantRoute } from '@/lib/tenancy/api';
import { inviteMember } from '@/lib/tenancy/invitations';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const GET = tenantRoute(
  async () =>
    NextResponse.json({
      success: true,
      data: await prisma.tenantInvitation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
        },
      }),
    }),
  true
);

export const POST = tenantRoute(async (req) => {
  const input = z
    .object({ email: z.string().email().max(320), role: z.enum(['ADMIN', 'OPERATIONS']) })
    .parse(await req.json());
  return NextResponse.json(
    { success: true, data: await inviteMember(input.email, input.role) },
    { status: 201 }
  );
}, true);

export const DELETE = tenantRoute(async (req) => {
  const { id } = z.object({ id: z.string().uuid() }).parse(await req.json());
  const result = await prisma.tenantInvitation.updateMany({
    where: { id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ success: true, data: { revoked: result.count } });
}, true);
