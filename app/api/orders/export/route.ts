import { withAuth } from '@/lib/api-middleware';
import { getPrismaClient } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * CSV export of recent orders for accounting / backup (Competitive Brief P2).
 * Limited to 5,000 rows; extend with filters if needed.
 */
export const GET = withAuth(
  async (_req: NextRequest) => {
    const prisma = getPrismaClient();
    const orders = await prisma.order.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        number: true,
        status: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        city: true,
        addressLine: true,
      },
    });

    const headers = [
      'number',
      'status',
      'customerName',
      'customerPhone',
      'customerEmail',
      'totalCents',
      'currency',
      'createdAt',
      'city',
      'addressLine',
    ];

    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [
      headers.join(','),
      ...orders.map((o) =>
        headers
          .map((h) => escape(o[h as keyof typeof o]))
          .join(',')
      ),
    ];

    const csv = '\uFEFF' + lines.join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  },
  { roles: ['ADMIN', 'OPERATIONS'] as const }
);
