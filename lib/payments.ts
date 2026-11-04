/**
 * Payment Service Layer
 *
 * Comprehensive payment management system including:
 * - Payment recording and refunds
 * - Order payment status synchronization
 * - Payment plans and installments
 * - Balance calculations
 * - Customer ledger integration
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PaymentStatus, PaymentMethod, PaymentPlanStatus, InstallmentStatus, CustomerLedgerEntryType } from '@prisma/client';
import { tPayment } from '@/lib/i18n';
import { auditCreate, auditUpdate, auditDelete } from '@/lib/audit';

// ===== TYPES =====

export interface RecordPaymentInput {
  orderId: string;
  method: PaymentMethod;
  amountCents: number;
  currency?: string;
  paymentDate?: Date;
  dueDate?: Date;
  reference?: string;
  notes?: string;
  creditCardLast4?: string;
  checkNumber?: string;
  bankTransactionId?: string;
  paymentProvider?: string;
  externalId?: string;
  receiptUrl?: string;
  processedBy?: string;
  approvedBy?: string;
  exchangeRate?: number;
  metadata?: any;
}

export interface RefundPaymentInput {
  paymentId: string;
  amountCents: number;
  reason: string;
  notes?: string;
  processedBy?: string;
}

export interface CreatePaymentPlanInput {
  orderId: string;
  totalAmountCents: number;
  currency?: string;
  numberOfInstallments: number;
  frequencyDays?: number;
  startDate?: Date;
  notes?: string;
  metadata?: any;
}

export interface RecordInstallmentInput {
  installmentId: string;
  paidAmountCents: number;
  paidDate?: Date;
  method: PaymentMethod;
  notes?: string;
  reference?: string;
  creditCardLast4?: string;
  checkNumber?: string;
  bankTransactionId?: string;
  paymentProvider?: string;
  receiptUrl?: string;
  processedBy?: string;
}

// ===== PAYMENT OPERATIONS =====

/**
 * Record a new payment for an order
 *
 * This function:
 * 1. Creates a Payment record
 * 2. Updates Order.paidAmountCents and Order.lastPaymentAt
 * 3. Updates Order.paymentStatus
 * 4. Creates CustomerLedgerEntry
 * 5. Creates audit trail
 */
export async function recordPayment(input: RecordPaymentInput, actorId?: string) {
  const {
    orderId,
    method,
    amountCents,
    currency = 'ILS',
    paymentDate = new Date(),
    dueDate,
    reference,
    notes,
    creditCardLast4,
    checkNumber,
    bankTransactionId,
    paymentProvider,
    externalId,
    receiptUrl,
    processedBy,
    approvedBy,
    exchangeRate,
    metadata,
  } = input;

  // Validate order exists
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  // Validate amount doesn't exceed outstanding balance
  const balance = await calculateOrderBalance(orderId);
  if (amountCents > balance.outstandingCents) {
    throw new Error(
      `Payment amount (${amountCents}) exceeds outstanding balance (${balance.outstandingCents})`
    );
  }

  // Create payment in a transaction
  const payment = await prisma.$transaction(async (tx) => {
    // 1. Create payment record
    const newPayment = await tx.payment.create({
      data: {
        orderId,
        method,
        status: PaymentStatus.PAID,
        amountCents,
        currency,
        paymentDate,
        dueDate,
        reference,
        notes,
        creditCardLast4,
        checkNumber,
        bankTransactionId,
        paymentProvider,
        externalId,
        receiptUrl,
        processedBy,
        approvedBy,
        exchangeRate,
        metadata,
      },
    });

    // 2. Update order payment fields
    const newPaidAmount = order.paidAmountCents + amountCents;
    const newPaymentStatus = determinePaymentStatus(newPaidAmount, order.totalCents);

    await tx.order.update({
      where: { id: orderId },
      data: {
        paidAmountCents: newPaidAmount,
        lastPaymentAt: paymentDate,
        paymentStatus: newPaymentStatus,
      },
    });

    // 3. Create customer ledger entry
    const newBalance = await getCustomerBalance(order.customerId);

    await tx.customerLedgerEntry.create({
      data: {
        customerId: order.customerId,
        orderId,
        paymentId: newPayment.id,
        type: CustomerLedgerEntryType.PAYMENT,
        deltaCents: -amountCents, // Negative because it reduces customer debt
        balanceCents: newBalance - amountCents,
        description: `תשלום ${formatPaymentMethod(method)} עבור הזמנה ${order.number}`,
        metadata: {
          paymentMethod: method,
          reference,
        },
      },
    });

    // 4. Create audit log
    await auditCreate({
      entity: 'Payment',
      entityId: newPayment.id,
      actorId: actorId || processedBy,
      data: newPayment,
    });

    return newPayment;
  });

  import('@/lib/push/webPush')
    .then(({ notifyPaymentReceivedWebPush }) =>
      notifyPaymentReceivedWebPush({
        orderId,
        orderNumber: order.number,
        amountCents,
      })
    )
    .catch((err) => {
      logger.warn('Web push payment notify skipped', err);
    });

  return payment;
}

/**
 * Refund a payment (partial or full)
 *
 * This function:
 * 1. Validates the refund amount
 * 2. Creates a new Payment record with status REFUNDED
 * 3. Updates original payment status if fully refunded
 * 4. Updates Order payment fields
 * 5. Creates CustomerLedgerEntry
 * 6. Creates audit trail
 */
export async function refundPayment(input: RefundPaymentInput, actorId?: string) {
  const { paymentId, amountCents, reason, notes, processedBy } = input;

  // Get original payment
  const originalPayment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });

  if (!originalPayment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  if (originalPayment.status === PaymentStatus.REFUNDED) {
    throw new Error('Payment has already been fully refunded');
  }

  if (amountCents > originalPayment.amountCents) {
    throw new Error(`Refund amount (${amountCents}) exceeds payment amount (${originalPayment.amountCents})`);
  }

  // Create refund in a transaction
  const refund = await prisma.$transaction(async (tx) => {
    // 1. Create refund payment record
    const refundPayment = await tx.payment.create({
      data: {
        orderId: originalPayment.orderId,
        method: originalPayment.method,
        status: PaymentStatus.REFUNDED,
        amountCents: -amountCents, // Negative amount for refund
        currency: originalPayment.currency,
        paymentDate: new Date(),
        reference: `REFUND-${originalPayment.reference || originalPayment.id}`,
        notes: `החזר: ${reason}${notes ? '. ' + notes : ''}`,
        processedBy,
        metadata: {
          originalPaymentId: originalPayment.id,
          refundReason: reason,
        },
      },
    });

    // 2. Update original payment status if fully refunded
    if (amountCents === originalPayment.amountCents) {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REFUNDED },
      });
    }

    // 3. Update order payment fields
    const order = originalPayment.order;
    if (!order) {
      throw new Error(`Order not found for payment ${paymentId}`);
    }
    const newPaidAmount = Math.max(0, order.paidAmountCents - amountCents);
    const newPaymentStatus = determinePaymentStatus(newPaidAmount, order.totalCents);

    await tx.order.update({
      where: { id: order.id },
      data: {
        paidAmountCents: newPaidAmount,
        paymentStatus: newPaymentStatus,
      },
    });

    // 4. Create customer ledger entry
    const customerId = order.customerId;
    const newBalance = await getCustomerBalance(customerId);

    await tx.customerLedgerEntry.create({
      data: {
        customerId,
        orderId: order.id,
        paymentId: refundPayment.id,
        type: CustomerLedgerEntryType.REFUND,
        deltaCents: amountCents, // Positive because it increases customer credit
        balanceCents: newBalance + amountCents,
        description: `החזר ${formatPaymentMethod(originalPayment.method)} - ${reason}`,
        metadata: {
          originalPaymentId: paymentId,
          refundReason: reason,
        },
      },
    });

    // 5. Create audit log
    await auditCreate({
      entity: 'Payment',
      entityId: refundPayment.id,
      actorId: actorId || processedBy,
      data: {
        ...refundPayment,
        refundReason: reason,
        originalPaymentId: paymentId,
      },
    });

    return refundPayment;
  });

  return refund;
}

// ===== PAYMENT PLAN OPERATIONS =====

/**
 * Create a payment plan for an order
 *
 * This function:
 * 1. Creates a PaymentPlan record
 * 2. Creates PaymentInstallment records for each installment
 * 3. Calculates due dates based on frequency
 */
export async function createPaymentPlan(input: CreatePaymentPlanInput, actorId?: string) {
  const {
    orderId,
    totalAmountCents,
    currency = 'ILS',
    numberOfInstallments,
    frequencyDays = 30,
    startDate = new Date(),
    notes,
    metadata,
  } = input;

  // Validate order exists
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { paymentPlans: { where: { status: PaymentPlanStatus.ACTIVE } } },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  // Check if order already has an active payment plan
  if (order.paymentPlans.length > 0) {
    throw new Error('Order already has an active payment plan');
  }

  // Calculate installment amount (distribute evenly, last installment gets remainder)
  const baseInstallmentAmount = Math.floor(totalAmountCents / numberOfInstallments);
  const lastInstallmentAmount = totalAmountCents - (baseInstallmentAmount * (numberOfInstallments - 1));

  // Create payment plan and installments in a transaction
  const paymentPlan = await prisma.$transaction(async (tx) => {
    // 1. Create payment plan
    const plan = await tx.paymentPlan.create({
      data: {
        orderId,
        totalAmountCents,
        currency,
        numberOfInstallments,
        frequencyDays,
        startDate,
        status: PaymentPlanStatus.ACTIVE,
        notes,
        metadata,
      },
    });

    // 2. Create installments
    const installments = [];
    for (let i = 0; i < numberOfInstallments; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + (i * frequencyDays));

      const amountCents = i === numberOfInstallments - 1 ? lastInstallmentAmount : baseInstallmentAmount;

      const installment = await tx.paymentInstallment.create({
        data: {
          paymentPlanId: plan.id,
          installmentNumber: i + 1,
          amountCents,
          dueDate,
          status: InstallmentStatus.PENDING,
        },
      });

      installments.push(installment);
    }

    // 3. Create audit log
    await auditCreate({
      entity: 'PaymentPlan',
      entityId: plan.id,
      actorId,
      data: {
        ...plan,
        installmentsCount: installments.length,
      },
    });

    return { ...plan, installments };
  });

  return paymentPlan;
}

/**
 * Record payment for a specific installment
 *
 * This function:
 * 1. Creates a Payment record
 * 2. Updates PaymentInstallment status and links payment
 * 3. Updates Order payment fields
 * 4. Checks if payment plan is completed
 * 5. Creates CustomerLedgerEntry
 */
export async function recordInstallment(input: RecordInstallmentInput, actorId?: string) {
  const {
    installmentId,
    paidAmountCents,
    paidDate = new Date(),
    method,
    notes,
    reference,
    creditCardLast4,
    checkNumber,
    bankTransactionId,
    paymentProvider,
    receiptUrl,
    processedBy,
  } = input;

  // Get installment with plan and order
  const installment = await prisma.paymentInstallment.findUnique({
    where: { id: installmentId },
    include: {
      paymentPlan: {
        include: {
          order: { include: { customer: true } },
          installments: true,
        },
      },
    },
  });

  if (!installment) {
    throw new Error(`Installment ${installmentId} not found`);
  }

  if (installment.status === InstallmentStatus.PAID) {
    throw new Error('Installment has already been paid');
  }

  if (installment.status === InstallmentStatus.CANCELLED) {
    throw new Error('Cannot pay a cancelled installment');
  }

  const order = installment.paymentPlan.order;

  // Record payment in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create payment record
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        method,
        status: PaymentStatus.PAID,
        amountCents: paidAmountCents,
        currency: installment.paymentPlan.currency,
        paymentDate: paidDate,
        reference: reference || `INST-${installment.installmentNumber}-${installment.paymentPlan.id}`,
        notes: notes || `תשלום ${installment.installmentNumber} מתוך ${installment.paymentPlan.numberOfInstallments}`,
        creditCardLast4,
        checkNumber,
        bankTransactionId,
        paymentProvider,
        receiptUrl,
        processedBy,
        metadata: {
          installmentId,
          installmentNumber: installment.installmentNumber,
          paymentPlanId: installment.paymentPlanId,
        },
      },
    });

    // 2. Update installment
    await tx.paymentInstallment.update({
      where: { id: installmentId },
      data: {
        status: InstallmentStatus.PAID,
        paidDate,
        paidAmountCents,
        paymentId: payment.id,
      },
    });

    // 3. Update order payment fields
    const newPaidAmount = order.paidAmountCents + paidAmountCents;
    const newPaymentStatus = determinePaymentStatus(newPaidAmount, order.totalCents);

    await tx.order.update({
      where: { id: order.id },
      data: {
        paidAmountCents: newPaidAmount,
        lastPaymentAt: paidDate,
        paymentStatus: newPaymentStatus,
      },
    });

    // 4. Check if payment plan is completed
    const allInstallments = installment.paymentPlan.installments;
    const allPaid = allInstallments.every(
      (inst) => inst.id === installmentId || inst.status === InstallmentStatus.PAID
    );

    if (allPaid) {
      await tx.paymentPlan.update({
        where: { id: installment.paymentPlanId },
        data: {
          status: PaymentPlanStatus.COMPLETED,
          endDate: paidDate,
        },
      });
    }

    // 5. Create customer ledger entry
    const newBalance = await getCustomerBalance(order.customerId);

    await tx.customerLedgerEntry.create({
      data: {
        customerId: order.customerId,
        orderId: order.id,
        paymentId: payment.id,
        type: CustomerLedgerEntryType.PAYMENT,
        deltaCents: -paidAmountCents,
        balanceCents: newBalance - paidAmountCents,
        description: `תשלום ${installment.installmentNumber}/${installment.paymentPlan.numberOfInstallments} - ${formatPaymentMethod(method)}`,
        metadata: {
          installmentId,
          paymentPlanId: installment.paymentPlanId,
        },
      },
    });

    // 6. Create audit log
    await auditCreate({
      entity: 'PaymentInstallment',
      entityId: installmentId,
      actorId: actorId || processedBy,
      data: {
        installment,
        payment,
      },
    });

    return { payment, installment };
  });

  import('@/lib/push/webPush')
    .then(({ notifyPaymentReceivedWebPush }) =>
      notifyPaymentReceivedWebPush({
        orderId: order.id,
        orderNumber: order.number,
        amountCents: paidAmountCents,
      })
    )
    .catch((err) => {
      logger.warn('Web push installment payment notify skipped', err);
    });

  return result;
}

/**
 * Update overdue installments
 *
 * This function should be run periodically (e.g., daily cron job)
 * to mark pending installments as overdue if past due date
 */
export async function updateInstallmentStatuses() {
  const now = new Date();

  const updated = await prisma.paymentInstallment.updateMany({
    where: {
      status: InstallmentStatus.PENDING,
      dueDate: {
        lt: now,
      },
    },
    data: {
      status: InstallmentStatus.OVERDUE,
    },
  });

  return { count: updated.count };
}

// ===== BALANCE CALCULATIONS =====

/**
 * Calculate payment balance for an order
 */
export async function calculateOrderBalance(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      totalCents: true,
      paidAmountCents: true,
      paymentStatus: true,
    },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  const outstandingCents = Math.max(0, order.totalCents - order.paidAmountCents);
  const percentPaid = order.totalCents > 0 ? (order.paidAmountCents / order.totalCents) * 100 : 0;

  return {
    totalCents: order.totalCents,
    paidAmountCents: order.paidAmountCents,
    outstandingCents,
    percentPaid,
    paymentStatus: order.paymentStatus,
  };
}

/**
 * Get customer's current balance across all orders
 */
export async function getCustomerBalance(customerId: string): Promise<number> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { currentBalanceCents: true },
  });

  if (!customer) {
    throw new Error(`Customer ${customerId} not found`);
  }

  return customer.currentBalanceCents;
}

/**
 * Recalculate customer balance from ledger entries
 *
 * This is a utility function to correct any discrepancies
 */
export async function recalculateCustomerBalance(customerId: string, actorId?: string) {
  const entries = await prisma.customerLedgerEntry.findMany({
    where: { customerId },
    orderBy: { createdAt: 'asc' },
  });

  let balance = 0;
  const updates = [];

  for (const entry of entries) {
    balance += entry.deltaCents;

    if (entry.balanceCents !== balance) {
      updates.push(
        prisma.customerLedgerEntry.update({
          where: { id: entry.id },
          data: { balanceCents: balance },
        })
      );
    }
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  // Update customer's current balance
  await prisma.customer.update({
    where: { id: customerId },
    data: { currentBalanceCents: balance },
  });

  // Create audit log if there were corrections
  if (updates.length > 0) {
    await auditUpdate({
      entity: 'Customer',
      entityId: customerId,
      actorId,
      before: { note: 'Balance recalculation' },
      after: { currentBalanceCents: balance, correctedEntries: updates.length },
    });
  }

  return { balance, correctedEntries: updates.length };
}

// ===== HELPER FUNCTIONS =====

/**
 * Determine order payment status based on paid amount vs total
 */
function determinePaymentStatus(paidCents: number, totalCents: number): PaymentStatus {
  if (paidCents === 0) {
    return PaymentStatus.PENDING;
  }

  if (paidCents >= totalCents) {
    return PaymentStatus.PAID;
  }

  return PaymentStatus.PARTIAL;
}

/**
 * Format payment method for display (Hebrew)
 */
function formatPaymentMethod(method: PaymentMethod): string {
  return tPayment('method', method, { fallback: method });
}

/**
 * Get payment statistics for an order
 */
export async function getOrderPaymentStats(orderId: string) {
  const [payments, balance, paymentPlan] = await Promise.all([
    prisma.payment.findMany({
      where: { orderId },
      orderBy: { paymentDate: 'desc' },
    }),
    calculateOrderBalance(orderId),
    prisma.paymentPlan.findFirst({
      where: { orderId, status: PaymentPlanStatus.ACTIVE },
      include: {
        installments: {
          orderBy: { installmentNumber: 'asc' },
        },
      },
    }),
  ]);

  // Calculate totals by method
  const paymentsByMethod = payments.reduce((acc, payment) => {
    if (payment.status !== PaymentStatus.REFUNDED) {
      acc[payment.method] = (acc[payment.method] || 0) + payment.amountCents;
    }
    return acc;
  }, {} as Record<PaymentMethod, number>);

  // Count refunds
  const refundedCount = payments.filter((p) => p.status === PaymentStatus.REFUNDED).length;
  const totalRefundedCents = payments
    .filter((p) => p.status === PaymentStatus.REFUNDED)
    .reduce((sum, p) => sum + Math.abs(p.amountCents), 0);

  return {
    balance,
    paymentsCount: payments.length - refundedCount,
    refundsCount: refundedCount,
    totalRefundedCents,
    paymentsByMethod,
    paymentPlan: paymentPlan
      ? {
          ...paymentPlan,
          paidInstallments: paymentPlan.installments.filter((i) => i.status === InstallmentStatus.PAID).length,
          overdueInstallments: paymentPlan.installments.filter((i) => i.status === InstallmentStatus.OVERDUE)
            .length,
        }
      : null,
    recentPayments: payments.slice(0, 5),
  };
}

/**
 * Get customer payment history
 */
export async function getCustomerPaymentHistory(
  customerId: string,
  options?: {
    limit?: number;
    offset?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }
) {
  const { limit = 50, offset = 0, dateFrom, dateTo } = options || {};

  const where = {
    customerId,
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
  };

  const [entries, total, balance] = await Promise.all([
    prisma.customerLedgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        order: {
          select: {
            number: true,
            totalCents: true,
          },
        },
        payment: {
          select: {
            method: true,
            reference: true,
          },
        },
      },
    }),
    prisma.customerLedgerEntry.count({ where }),
    getCustomerBalance(customerId),
  ]);

  return {
    entries,
    total,
    limit,
    offset,
    currentBalance: balance,
  };
}
