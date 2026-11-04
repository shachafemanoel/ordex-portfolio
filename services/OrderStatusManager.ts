import { normalizeStatus } from '@/domain/status/legacyStatusMap';
import { prisma } from '@/lib/db';
import { normalizeOrderStatus, ORDER_STATUS_TRANSITIONS } from '@/lib/orderStatus';

interface StatusChangeContext {
  userId: string;
  reason?: string;
}

interface StatusChangeError extends Error {
  code: number;
}

export class OrderStatusManager {
  /**
   * Attempt to change an order's status.
   * Throws with code 409 if the transition is not allowed.
   */
  async setStatus(
    orderId: string,
    rawStatus: string,
    context: StatusChangeContext
  ): Promise<{ id: string; status: string }> {
    const targetStatus = normalizeStatus(rawStatus);
    const normalizedTarget = normalizeOrderStatus(targetStatus);

    // Fetch the order to get current status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      const err = new Error(`Order ${orderId} not found`) as StatusChangeError;
      err.code = 404;
      throw err;
    }

    const currentNormalized = normalizeOrderStatus(order.status);
    const allowed = ORDER_STATUS_TRANSITIONS[currentNormalized] ?? [];

    if (!allowed.includes(normalizedTarget) && currentNormalized !== normalizedTarget) {
      const err = new Error(
        `Transition from ${order.status} to ${targetStatus} is not allowed`
      ) as StatusChangeError;
      err.code = 409;
      throw err;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: normalizedTarget },
    });
    return { id: updated.id, status: updated.status };
  }
}
