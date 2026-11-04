import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { normalizeCustomers } from '@/domain/customers/normalizeCustomer';

export const dynamic = 'force-dynamic';

const SearchParamsSchema = z.object({
  term: z.string().min(1, 'term is required').max(100, 'term is too long').transform((s) => s.trim()),
  limit: z.coerce.number().min(1).max(20).optional(),
});

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const rawParams = Object.fromEntries(url.searchParams);
    const { term, limit = 10 } = SearchParamsSchema.parse(rawParams);

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term } },
          {
            orders: {
              some: {
                deletedAt: null,
                OR: [
                  { number: { contains: term, mode: 'insensitive' } },
                  { orderNumber: { contains: term, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      include: {
        addresses: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            number: true,
            status: true,
            totalCents: true,
            createdAt: true,
          },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    return createSuccessResponse({
      customers: normalizeCustomers(customers),
    });
  } catch (error) {
    console.error('Failed to search customers:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Invalid search parameters',
            details: error.errors,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to search customers',
        },
      },
      { status: 500 },
    );
  }
}, { permissions: ['VIEW_CUSTOMERS'] });
