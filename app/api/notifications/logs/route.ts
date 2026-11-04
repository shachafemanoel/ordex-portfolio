import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const NotificationLogsFilter = z.object({
  orderId: z.string().optional(),
  type: z.enum(['sms', 'whatsapp', 'email']).optional(),
  status: z.enum(['pending', 'sent', 'delivered', 'failed']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const GET = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
  try {
    const { searchParams } = request.nextUrl;
    const params = Object.fromEntries(searchParams.entries());

    const parsed = NotificationLogsFilter.safeParse(params);
    if (!parsed.success) {
      return createErrorResponse('Invalid query parameters', 400, parsed.error.flatten());
    }

    const filters = parsed.data;
    const whereClause: any = {};

    if (filters.orderId) {
      whereClause.orderId = filters.orderId;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.createdAt = {};
      if (filters.dateFrom) {
        whereClause.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause.createdAt.lte = new Date(filters.dateTo);
      }
    }

    const logs =
      (await prisma.messageLog?.findMany({
        where: {
          ...whereClause,
          ...(filters.type ? { channel: filters.type.toUpperCase() as any } : {}),
        },
        include: {
          order: {
            select: {
              id: true,
              number: true,
              customerName: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
              channel: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })) ?? [];

    return createSuccessResponse(logs);
  } catch (error) {
    console.error('Error fetching notification logs:', error);
    return createErrorResponse('Failed to fetch notification logs', 500);
  }
},
  { permissions: ['VIEW_ORDERS'] }
);
