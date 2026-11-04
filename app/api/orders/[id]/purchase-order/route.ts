import { createSuccessResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  supplierId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
});

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const orderId = params.id;
      const body = bodySchema.parse(await req.json());

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) {
        return NextResponse.json(
          { success: false, error: { message: 'Order not found' } },
          { status: 404 }
        );
      }

      const items =
        body.items ??
        order.items.map((item) => ({
          orderItemId: item.id,
          quantity: item.qty,
        }));

      // Resolve supplier
      const supplierId =
        body.supplierId ?? order.items.find((i) => i.supplierId)?.supplierId ?? null;

      if (!supplierId) {
        return NextResponse.json(
          { success: false, error: { message: 'Supplier is required to create purchase order' } },
          { status: 400 }
        );
      }

      const reference = `PO-${Date.now()}`;

      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          supplierId,
          reference,
          linkedOrderIds: [orderId],
          status: 'DRAFT',
          items: {
            create: items
              .map((input) => {
                const item = order.items.find((i) => i.id === input.orderItemId);
                if (!item) {
                  throw new Error(`Order item ${input.orderItemId} not found`);
                }
                return {
                  productId: item.productId!,
                  qtyOrdered: input.quantity,
                };
              })
              .filter((item) => item.productId != null),
          },
        },
        include: { items: true },
      });

      return createSuccessResponse(purchaseOrder, undefined, 'הזמנת רכש נוצרה');
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;
      return asInternal();
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);
