export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { generateOrderNumber } from '@/lib/services/orders';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const SplitOrderSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, 'יש לבחור לפחות פריט אחד להעברה'),
  notes: z.string().optional(),
});

/**
 * POST /api/orders/:id/split
 *
 * Splits selected items from an existing order into a new draft order.
 * The specified items are moved to the new order; the original order keeps the rest.
 */
export const POST = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const validation = SplitOrderSchema.safeParse(body);

      if (!validation.success) {
        return createErrorResponse('נתונים לא תקינים', 400, {
          errors: validation.error.flatten().fieldErrors,
        });
      }

      const { itemIds, notes } = validation.data;

      const sourceOrder = await prisma.order.findUnique({
        where: { id: params.id },
        include: { items: true },
      });

      if (!sourceOrder) {
        return createErrorResponse('הזמנה לא נמצאה', 404);
      }

      const FINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'INVOICED'];
      if (FINAL_STATUSES.includes(sourceOrder.status)) {
        return createErrorResponse('לא ניתן לפצל הזמנה בסטטוס סופי', 400);
      }

      // Validate requested items belong to this order
      const itemsToMove = sourceOrder.items.filter((item) => itemIds.includes(item.id));
      if (itemsToMove.length === 0) {
        return createErrorResponse('הפריטים שנבחרו לא נמצאו בהזמנה זו', 400);
      }

      // Must leave at least one item in the original order
      const remainingItems = sourceOrder.items.filter((item) => !itemIds.includes(item.id));
      if (remainingItems.length === 0) {
        return createErrorResponse('לא ניתן להעביר את כל הפריטים — יש להשאיר לפחות פריט אחד בהזמנה המקורית', 400);
      }

      const newNumber = await generateOrderNumber();
      const now = new Date();

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const actorId = UUID_RE.test(user.id) ? user.id : null;

      const result = await prisma.$transaction(async (tx) => {
        // Calculate totals for the new (split) order
        const newSubTotal = itemsToMove.reduce((sum, item) => sum + (item.totalCents ?? item.priceCents * item.qty), 0);

        // Create new split order
        const newOrder = await tx.order.create({
          data: {
            number: newNumber,
            status: 'TO_DO',
            customerId: sourceOrder.customerId,
            billingAddressId: sourceOrder.billingAddressId,
            shippingAddressId: sourceOrder.shippingAddressId,
            channel: sourceOrder.channel,
            currency: sourceOrder.currency,
            priority: sourceOrder.priority,
            fulfillmentType: sourceOrder.fulfillmentType,
            notes: notes ?? sourceOrder.notes,
            notesInternal: `פוצל מהזמנה #${sourceOrder.number}${sourceOrder.notesInternal ? `\n${sourceOrder.notesInternal}` : ''}`,
            city: sourceOrder.city,
            addressLine: sourceOrder.addressLine,
            street: sourceOrder.street,
            houseNumber: sourceOrder.houseNumber,
            floor: sourceOrder.floor,
            apartment: sourceOrder.apartment,
            lat: sourceOrder.lat,
            lng: sourceOrder.lng,
            customerName: sourceOrder.customerName,
            customerPhone: sourceOrder.customerPhone,
            customerEmail: sourceOrder.customerEmail,
            createdByUserId: actorId,
            subTotalCents: newSubTotal,
            taxCents: 0,
            shippingCents: 0,
            discountCents: 0,
            totalCents: newSubTotal,
            paidAmountCents: 0,
            paymentStatus: 'PENDING',
            statusUpdatedAt: now,
            lastActionAt: now,
            opsLane: 'NEEDS_ACTION',
            isDraft: false,
          },
        });

        // Move selected items to new order
        await tx.orderItem.updateMany({
          where: { id: { in: itemIds }, orderId: params.id },
          data: { orderId: newOrder.id },
        });

        // Recalculate original order totals
        const origSubTotal = remainingItems.reduce(
          (sum, item) => sum + (item.totalCents ?? item.priceCents * item.qty),
          0
        );
        await tx.order.update({
          where: { id: params.id },
          data: {
            subTotalCents: origSubTotal,
            totalCents: origSubTotal,
            notesInternal: `${sourceOrder.notesInternal ?? ''}\nפוצלה — הזמנה חדשה #${newNumber} נוצרה`.trim(),
            updatedAt: now,
          },
        });

        return newOrder;
      });

      return createSuccessResponse(
        {
          newOrderId: result.id,
          newOrderNumber: result.number,
          sourceOrderId: params.id,
          movedItemCount: itemsToMove.length,
          remainingItemCount: remainingItems.length,
        },
        undefined,
        `ההזמנה פוצלה בהצלחה — נוצרה הזמנה חדשה #${result.number}`
      );
    } catch (error) {
      console.error('Failed to split order:', error);
      return createErrorResponse(
        error instanceof Error ? error.message : 'שגיאה בפיצול ההזמנה',
        500
      );
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);
