import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';

export class StripeWebhookProcessor {
  static async handlePaymentSuccess(payload: any) {
    const paymentIntent = payload.data.object;
    const paymentIntentId = paymentIntent.id;
    const amountCents = paymentIntent.amount;
    const currency = paymentIntent.currency.toUpperCase();
    const orderId = paymentIntent.metadata?.orderId;

    console.log('Payment success webhook:', {
      paymentIntentId,
      amount: amountCents,
      currency,
      orderId,
    });

    if (!orderId) {
      console.error('Order ID missing in payment intent metadata');
      return { processed: false, reason: 'missing_order_id' };
    }

    try {
      // Perform DB operations in a transaction for consistency
      const result = await prisma.$transaction(async (tx) => {
        // 1. Idempotency check
        const existingPayment = await tx.payment.findFirst({
          where: { bankTransactionId: paymentIntentId },
        });

        if (existingPayment) {
          return { status: 'already_processed' as const };
        }

        // 2. Fetch Order with fresh state
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { customer: true },
        });

        if (!order) {
          return { status: 'order_not_found' as const };
        }

        // 3. Create Payment record
        await tx.payment.create({
          data: {
            orderId,
            method: PaymentMethod.STRIPE,
            status: PaymentStatus.PAID,
            amountCents,
            currency,
            paymentDate: new Date(),
            paymentProvider: 'Stripe',
            bankTransactionId: paymentIntentId,
          },
        });

        // 4. Calculate new totals
        const newPaidAmount = (order.paidAmountCents || 0) + amountCents;
        const isFullyPaid = newPaidAmount >= order.totalCents;
        const newPaymentStatus = isFullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

        // Determine new order status
        let newOrderStatus = order.status;
        const earlyStatuses: OrderStatus[] = [OrderStatus.DRAFT, OrderStatus.PENDING_APPROVAL, OrderStatus.TO_DO];
        if (earlyStatuses.includes(order.status)) {
          newOrderStatus = OrderStatus.CONFIRMED;
        }

        // 5. Update Order
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: newOrderStatus,
            paymentStatus: newPaymentStatus,
            paidAmountCents: newPaidAmount,
            lastPaymentAt: new Date(),
          },
          include: { customer: true }
        });

        return { status: 'success' as const, order: updatedOrder };
      });

      // Handle transaction result
      if (result.status === 'already_processed') {
        console.log(`Payment ${paymentIntentId} already processed`);
        return { processed: true, message: 'already_processed' };
      }

      if (result.status === 'order_not_found') {
        console.error(`Order ${orderId} not found`);
        return { processed: false, reason: 'order_not_found' };
      }

      void import('@/lib/push/webPush')
        .then(({ notifyPaymentReceivedWebPush }) =>
          notifyPaymentReceivedWebPush({
            orderId: result.order.id,
            orderNumber: result.order.number,
            amountCents,
          })
        )
        .catch(() => undefined);

      // Send Confirmation Email (outside transaction)
      const order = result.order;
      if (order?.customer?.email) {
        const amountFormatted = (amountCents / 100).toFixed(2);
        await sendEmail(
          order.customer.email,
          `Payment Received - Order #${order.number}`,
          `Thank you! We have received your payment of ${amountFormatted} ${currency} for Order #${order.number}.\n\nCurrent Status: ${OrderStatus.CONFIRMED}`
        );
      }

      return { processed: true, paymentIntentId };
    } catch (error) {
      console.error(`Error processing payment success for order ${orderId}:`, error);
      return {
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
