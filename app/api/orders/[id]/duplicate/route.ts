export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { generateOrderNumber } from '@/lib/services/orders';
import { NextRequest } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/orders/:id/duplicate
 *
 * Creates a draft copy of an existing order with copied line items.
 */
export const POST = withAuth(
  async (_req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const sourceOrder = await prisma.order.findUnique({
        where: { id: params.id },
        include: { items: true },
      });

      if (!sourceOrder) {
        return createErrorResponse('Order not found', 404);
      }

      const newNumber = await generateOrderNumber();
      const now = new Date();
      const actorId = UUID_RE.test(user.id) ? user.id : null;

      const duplicated = await prisma.$transaction(async (tx) => {
        const duplicatedOrder = await tx.order.create({
          data: {
            number: newNumber,
            status: 'DRAFT',
            customerId: sourceOrder.customerId,
            billingAddressId: sourceOrder.billingAddressId,
            shippingAddressId: sourceOrder.shippingAddressId,
            channel: sourceOrder.channel,
            currency: sourceOrder.currency,
            priority: sourceOrder.priority,
            fulfillmentType: sourceOrder.fulfillmentType,
            notes: sourceOrder.notes,
            notesInternal: sourceOrder.notesInternal,
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
            assignedUserId: actorId,
            subTotalCents: sourceOrder.subTotalCents,
            taxCents: sourceOrder.taxCents,
            shippingCents: sourceOrder.shippingCents,
            discountCents: sourceOrder.discountCents,
            totalCents: sourceOrder.totalCents,
            paidAmountCents: 0,
            paymentStatus: 'PENDING',
            lastPaymentAt: null,
            scheduledAt: null,
            scheduledEnd: null,
            statusUpdatedAt: now,
            statusStartedAt: now,
            lastActionAt: now,
            taskLabel: null,
            opsLane: 'NEEDS_ACTION',
            opsCurrentTask: null,
            opsSnoozeUntil: null,
            opsSnoozeReason: null,
            urgent: false,
            onHold: false,
            isDraft: true,
          },
        });

        if (sourceOrder.items.length > 0) {
          await tx.orderItem.createMany({
            data: sourceOrder.items.map((item) => ({
              orderId: duplicatedOrder.id,
              productId: item.productId,
              supplierId: item.supplierId,
              sku: item.sku,
              name: item.name,
              qty: item.qty,
              priceCents: item.priceCents,
              totalCents: item.totalCents,
              vatCategory: item.vatCategory,
              taxRate: item.taxRate,
              is_tax_included: item.is_tax_included,
              remarks: item.remarks,
              allocationStatus: item.allocationStatus,
              receivedQuantity: 0,
              received: false,
            })),
          });
        }

        return duplicatedOrder;
      });

      return createSuccessResponse({
        id: duplicated.id,
        number: duplicated.number,
        status: duplicated.status,
        sourceOrderId: sourceOrder.id,
      });
    } catch (error) {
      console.error('Failed to duplicate order:', error);
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to duplicate order',
        500
      );
    }
  }
);
