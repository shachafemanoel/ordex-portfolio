import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export async function listInstallations(params: {
  cursor?: string;
  limit: number;
  sort: 'createdAt' | 'updatedAt';
  dir: 'asc' | 'desc';
  status?: string[];
  q?: string;
  from?: Date;
  to?: Date;
}) {
  const searchNumber = params.q ? Number(params.q) : NaN;

  const where: Prisma.OrderWhereInput = {
    AND: [
      params.status?.length ? { status: { in: params.status as any } } : {},
      params.q
        ? {
            OR: [
              !isNaN(searchNumber) ? { number: searchNumber } : undefined,
              { customerName: { contains: params.q, mode: 'insensitive' } },
              { client: { name: { contains: params.q, mode: 'insensitive' } } },
            ].filter(Boolean) as Prisma.OrderWhereInput['OR'],
          }
        : {},
      params.from || params.to
        ? {
            scheduledAt: {
              gte: params.from ?? undefined,
              lte: params.to ?? undefined,
            },
          }
        : {},
    ],
  };

  const orderBy: any = { [params.sort]: params.dir };
  const take = params.limit;
  const cursor = params.cursor ? { id: params.cursor } : undefined;

  const items = await prisma.order.findMany({
    where,
    orderBy,
    take: take + 1,
    ...(cursor ? { cursor, skip: 1 } : {}),
  });
  const next = items.length > take ? items.pop() : null;
  const total = await prisma.order.count({ where });

  return { items, total, nextCursor: next?.id ?? null };
}
