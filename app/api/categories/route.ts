import { createSuccessResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return createSuccessResponse({
    items: categories,
    total: categories.length,
  });
});

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser) => {
    const body = await req.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: { name, slug },
    });

    return createSuccessResponse(category, undefined, 'Category created');
  }
);
