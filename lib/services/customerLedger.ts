import { Prisma, CustomerLedgerEntryType } from '@prisma/client';

type LedgerEntryParams = {
  customerId: string;
  orderId?: string | null;
  paymentId?: string | null;
  deltaCents: number;
  type: CustomerLedgerEntryType;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

function resolveBalanceUpdate(deltaCents: number) {
  if (deltaCents === 0) {
    return undefined;
  }
  if (deltaCents > 0) {
    return { currentBalanceCents: { increment: deltaCents } };
  }
  return { currentBalanceCents: { decrement: Math.abs(deltaCents) } };
}

export async function appendLedgerEntry(
  tx: Prisma.TransactionClient,
  params: LedgerEntryParams
) {
  try {
    if (params.deltaCents === 0) {
      return null;
    }

    const balanceUpdate = resolveBalanceUpdate(params.deltaCents);
    if (!balanceUpdate) {
      return null;
    }

    const updatedCustomer = await tx.customer.update({
      where: { id: params.customerId },
      data: balanceUpdate,
      select: { currentBalanceCents: true },
    });

    return tx.customerLedgerEntry.create({
      data: {
        customerId: params.customerId,
        orderId: params.orderId ?? null,
        paymentId: params.paymentId ?? null,
        type: params.type,
        deltaCents: params.deltaCents,
        balanceCents: updatedCustomer.currentBalanceCents,
        description: params.description ?? null,
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (error) {
    console.error(`Failed to append ledger entry for customer ${params.customerId}:`, error);
    // Re-throw the error to be handled by the caller's transaction logic
    throw error;
  }
}

export async function recordOrderCharge(
  tx: Prisma.TransactionClient,
  customerId: string,
  orderId: string,
  amountCents: number,
  description?: string
) {
  if (amountCents <= 0) return null;
  return appendLedgerEntry(tx, {
    customerId,
    orderId,
    deltaCents: amountCents,
    type: CustomerLedgerEntryType.CHARGE,
    description: description ?? `חיוב הזמנה`,
  });
}

export async function recordOrderPayment(
  tx: Prisma.TransactionClient,
  customerId: string,
  orderId: string,
  paymentId: string | null,
  paidDeltaCents: number,
  description?: string
) {
  if (paidDeltaCents === 0) return null;
  // Payments reduce the balance
  return appendLedgerEntry(tx, {
    customerId,
    orderId,
    paymentId: paymentId ?? undefined,
    deltaCents: -Math.abs(paidDeltaCents),
    type: CustomerLedgerEntryType.PAYMENT,
    description: description ?? 'תשלום שהתקבל',
  });
}

export async function recordOrderAdjustment(
  tx: Prisma.TransactionClient,
  customerId: string,
  orderId: string,
  deltaCents: number,
  description?: string
) {
  if (deltaCents === 0) return null;
  return appendLedgerEntry(tx, {
    customerId,
    orderId,
    deltaCents,
    type: CustomerLedgerEntryType.ADJUSTMENT,
    description: description ?? 'עדכון יתרה להזמנה',
  });
}
