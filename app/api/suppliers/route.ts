export const dynamic = 'force-dynamic';

import { createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

function toPositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export const GET = withAuth(
  async (req: NextRequest) => {
    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get('q')?.trim();
    const page = toPositiveInt(searchParams.get('page'), 1, 10_000);
    const limit = toPositiveInt(searchParams.get('limit'), 50, 200);

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          _count: {
            select: {
              products: true,
              purchaseOrders: true,
            },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return createSuccessResponse(
      {
        items: items.map((supplier) => ({
          id: supplier.id,
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone,
          productsCount: supplier._count.products,
          purchaseOrdersCount: supplier._count.purchaseOrders,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      }
    );
  },
  { permissions: ['VIEW_ORDERS'] }
);
