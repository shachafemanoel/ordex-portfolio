import { prisma } from '@/lib/db';
import { getStatusLabel, normalizeOrderStatus } from '@/lib/orderStatus';
import {
  acquireOrderMutationLock,
  assertOrderVersion,
  parseOrderVersionToken,
} from '@/lib/orders/concurrency';
import { mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { computeReceiptProgress } from '@/lib/orders/receiptProgress';
import { syncOrderOperationalState } from '@/lib/services/orders/statusRecalculation';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface ReceiveItemUpdate {
  itemId: string;
  quantity: number;
}

interface ReceiveRequest {
  items: ReceiveItemUpdate[];
  note?: string;
  expectedUpdatedAt?: string;
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await props.params;
  const ordersService = getProductionOrdersService();

  try {
    const orderId = params.id;
    const body: ReceiveRequest = await req.json();
    const expectedVersionToken =
      body.expectedUpdatedAt ??
      req.headers.get('if-match') ??
      req.headers.get('if-unmodified-since');
    const expectedUpdatedAt = parseOrderVersionToken(expectedVersionToken);

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'No items to receive' },
        },
        { status: 400 }
      );
    }

    if (expectedVersionToken && !expectedUpdatedAt) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Invalid expectedUpdatedAt / If-Match header format' },
        },
        { status: 400 }
      );
    }

    const quantitiesByItem = new Map<string, number>();
    for (const update of body.items) {
      if (!update.itemId || update.quantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: { message: 'Invalid item update: itemId and positive quantity are required' },
          },
          { status: 400 }
        );
      }
      quantitiesByItem.set(
        update.itemId,
        (quantitiesByItem.get(update.itemId) ?? 0) + update.quantity
      );
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await acquireOrderMutationLock(tx, orderId);
      await assertOrderVersion(tx, orderId, expectedUpdatedAt);

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new Error('order_not_found');
      }

      const itemsById = new Map(order.items.map((item) => [item.id, item]));

      for (const [itemId, quantity] of quantitiesByItem.entries()) {
        const item = itemsById.get(itemId);
        if (!item) {
          throw new Error(`item_not_found:${itemId}`);
        }

        const currentReceived = item.receivedQuantity || 0;
        const newReceived = currentReceived + quantity;

        if (newReceived > item.qty) {
          throw new Error(`item_overflow:${item.name}`);
        }

        await tx.orderItem.update({
          where: { id: itemId },
          data: {
            receivedQuantity: newReceived,
            received: newReceived >= item.qty,
          },
        });
      }

      const refreshedOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!refreshedOrder) {
        throw new Error('order_refresh_failed');
      }

      return refreshedOrder;
    });

    const { totalQty, receivedQty, progress } = computeReceiptProgress(updatedOrder.items);

    const allItemsReceived = updatedOrder.items.every(
      (item) => (item.receivedQuantity || 0) >= item.qty
    );

    // Canonical statuses: PARTIALLY_SUPPLIED vs INSTALL_SCHEDULING trigger
    const targetStatus = normalizeOrderStatus(
      allItemsReceived ? 'INSTALL_SCHEDULING' : 'PARTIALLY_SUPPLIED'
    );

    await ordersService.changeOrderStatus(
      orderId,
      {
        newStatus: targetStatus,
        reason: body.note || (allItemsReceived ? 'קליטת סחורה מלאה' : 'קליטה חלקית'),
        metadata: {
          receipt: {
            totalQty,
            receivedQty,
            progress,
            items: Array.from(quantitiesByItem.entries()).map(([itemId, quantity]) => ({
              itemId,
              quantity,
            })),
          },
        },
      },
      'system-receive'
    );

    await syncOrderOperationalState(orderId, {
      reason: body.note || 'עדכון קבלת סחורה',
    });

    return NextResponse.json({
      success: true,
      newStatus: targetStatus,
      newStatusLabel: getStatusLabel(targetStatus),
      fullyReceived: allItemsReceived,
      progress,
      message: allItemsReceived
        ? 'All items received - ready for installation scheduling'
        : 'Partially received - some items still pending',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'order_not_found') {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Order not found' },
        },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message.startsWith('item_not_found:')) {
      const itemId = error.message.split(':')[1];
      return NextResponse.json(
        {
          success: false,
          error: { message: `Item ${itemId} not found in order` },
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.startsWith('item_overflow:')) {
      const itemName = error.message.split(':')[1];
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Cannot receive more than ordered for item ${itemName}`,
          },
        },
        { status: 400 }
      );
    }

    const mapped = mapErrorToResponse(error);
    if (mapped) return mapped;

    console.error('Error receiving items:', error);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Failed to receive items' },
      },
      { status: 500 }
    );
  }
}
