import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { orderPriorityUpdateSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export const PUT = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const id = params.id;

      // Validate body
      const body = await req.json();
      const parseResult = orderPriorityUpdateSchema.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: parseResult.error.errors },
          { status: 400 }
        );
      }

      const { priority } = parseResult.data;

      // Update order priority
      const updated = await prisma.order.update({
        where: { id },
        data: { priority },
      });

      return NextResponse.json({ success: true, data: updated }, { status: 200 });
    } catch (error) {
      console.error('Error updating order priority:', error);

      // Handle specific Prisma errors
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'P2025') {
          return NextResponse.json(
            { error: 'Order not found' },
            { status: 404 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Failed to update order priority' },
        { status: 500 }
      );
    }
  }
);

export const POST = PUT; // Allow POST as an alias if needed by clients

