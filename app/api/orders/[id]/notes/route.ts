import { createSuccessResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { orderNoteCreateSchema } from '@/lib/schemas';
import { mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ordersService = getProductionOrdersService();

// Keep response shape simple (array/object) to match existing UI component

export const GET = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    // In Next.js 15 params is a Promise, safe to await it even in 14 if typed as Promise?
    // But keeping it synchronous access for now as per other routes in this project.
    // If we want to be robust we can just access it.
    // Wait, other routes verified in this codebase access params.id directly.
    // Assuming synchronous params.
    const orderId = params.id;

    try {
      // Use service to check existence (handles ORD-*, Redis fallback, etc)
      // This throws ApiError(404) if not found, or returns null?
      // ordersService.getOrderById returns OrderEntity | null.
      const order = await ordersService.getOrderById(orderId);

      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // If found, we use the RESOLVED ID (in case orderId was ORD-*)
      // The notes are stored against the UUID.
      const resolvedId = order.id;

      const notes = await prisma.orderNote.findMany({
        where: { orderId: resolvedId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return createSuccessResponse(notes);
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;
      console.error('GET notes error', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const orderId = params.id;

    try {
      // Validate order existence via service
      const order = await ordersService.getOrderById(orderId);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      const resolvedId = order.id;

      // Validate body using shared schema
      const body = await req.json();
      const { content } = orderNoteCreateSchema.parse(body);

      const note = await prisma.orderNote.create({
        data: {
          content,
          userId: user.id,
          orderId: resolvedId, // Use resolved UUID
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return NextResponse.json({ success: true, data: note }, { status: 201 });
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;
      console.error('POST notes error', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
