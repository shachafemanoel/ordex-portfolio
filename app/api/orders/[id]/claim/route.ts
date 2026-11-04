export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { isClaimStale } from '@/lib/services/order-claim';

/**
 * POST /api/orders/:id/claim
 *
 * Claim or release an order for working.
 * Body: { release?: boolean }
 *
 * On claim: sets workingByUserId + workingStartedAt
 * On release: clears both fields
 * If already claimed by another user (and not stale): returns 409
 */
export const POST = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const { id } = params;
      const body = await req.json().catch(() => ({}));
      const release = body.release === true;

      const order = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          workingByUserId: true,
          workingStartedAt: true,
          workingByUser: { select: { id: true, name: true } },
        },
      });

      if (!order) {
        return createErrorResponse('Order not found', 404);
      }

      // Release
      if (release) {
        await prisma.order.update({
          where: { id },
          data: {
            workingByUserId: null,
            workingStartedAt: null,
          },
        });
        return createSuccessResponse({ claimed: false });
      }

      // Claim - check if already claimed by someone else
      if (
        order.workingByUserId &&
        order.workingByUserId !== user.id &&
        !isClaimStale(order.workingStartedAt)
      ) {
        return createErrorResponse(
          `Order is being worked on by ${order.workingByUser?.name || 'another user'}`,
          409
        );
      }

      // Claim it
      const updated = await prisma.order.update({
        where: { id },
        data: {
          workingByUserId: user.id,
          workingStartedAt: new Date(),
        },
        select: {
          workingByUserId: true,
          workingStartedAt: true,
          workingByUser: { select: { id: true, name: true } },
        },
      });

      return createSuccessResponse({
        claimed: true,
        workingByUser: updated.workingByUser,
        workingStartedAt: updated.workingStartedAt,
      });
    } catch (error) {
      console.error('Failed to claim order:', error);
      return createErrorResponse('Failed to claim order', 500);
    }
  }
);
