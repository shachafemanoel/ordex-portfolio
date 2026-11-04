import { prisma } from '@/lib/db';
import { tenantRoute } from '@/lib/tenancy/api';
import { revokeMembership } from '@/lib/tenancy/invitations';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const GET = tenantRoute(
  async () =>
    NextResponse.json({
      success: true,
      data: await prisma.tenantMembership.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          isActive: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    }),
  true
);

export const DELETE = tenantRoute(async (req) => {
  const { id } = z.object({ id: z.string().uuid() }).parse(await req.json());
  await revokeMembership(id);
  return NextResponse.json({ success: true });
}, true);
