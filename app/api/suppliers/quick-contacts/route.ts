import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PostBodySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
});

export const GET = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser) => {
    const items = await prisma.supplier.findMany({
      where: { quickContact: true, email: { not: null } },
      orderBy: { name: 'asc' },
      take: 200,
      select: { id: true, name: true, email: true },
    });
    return createSuccessResponse({
      items: items
        .filter((r): r is { id: string; name: string; email: string } => Boolean(r.email?.trim()))
        .map((r) => ({ id: r.id, name: r.name, email: r.email.trim() })),
    });
  },
  { permissions: ['VIEW_ORDERS'] }
);

export const POST = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }
    const parsed = PostBodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse('Validation failed', 400, parsed.error.flatten());
    }

    const name = parsed.data.name.trim();
    const email = parsed.data.email.trim().toLowerCase();

    const existing = await prisma.supplier.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existing) {
      const updated = await prisma.supplier.update({
        where: { id: existing.id },
        data: { name, quickContact: true },
        select: { id: true, name: true, email: true },
      });
      return createSuccessResponse({
        id: updated.id,
        name: updated.name,
        email: updated.email?.trim() ?? email,
      });
    }

    const created = await prisma.supplier.create({
      data: {
        name,
        email,
        quickContact: true,
      },
      select: { id: true, name: true, email: true },
    });

    return createSuccessResponse({
      id: created.id,
      name: created.name,
      email: created.email?.trim() ?? email,
    });
  },
  { permissions: ['SEND_OPERATIONAL_EMAIL'] }
);
