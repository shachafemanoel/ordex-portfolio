import { PaymentStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addManualPayment, upsertOrderPayment } from '@/lib/services/orders';
import { DomainError } from '@/lib/server/errors';

const prismaTxMock = vi.hoisted(() => {
  const tx = {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    customer: {
      update: vi.fn(),
    },
    customerLedgerEntry: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  return {
    tx,
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };
});

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: prismaTxMock.$transaction,
  },
}));

const ORDER_ID = 'd290f1ee-6c54-4b01-90e6-d701748f0851';
const USER_ID = '0e98589f-2680-4ff8-a3e1-3ddb5a67f1f3';

describe('upsertOrderPayment', () => {
  const tx = prismaTxMock.tx;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new payment record with a valid status', async () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const paymentRecord = {
      id: 'payment-1',
      orderId: ORDER_ID,
      method: 'CREDIT_CARD',
      amountCents: 12500,
      status: PaymentStatus.PAID,
      createdAt,
      updatedAt: createdAt,
    };

    const existingOrder = {
      id: ORDER_ID,
      customerId: 'customer-123',
      paidAmountCents: 0,
      paymentStatus: PaymentStatus.PENDING,
      lastPaymentAt: null,
    };

    const updatedOrder = {
      ...existingOrder,
      paidAmountCents: paymentRecord.amountCents,
      paymentStatus: PaymentStatus.PAID,
      lastPaymentAt: createdAt,
    };

    const updatedCustomer = {
      id: 'customer-123',
      currentBalanceCents: 12500,
    };

    const ledgerEntry = {
      id: 'ledger-1',
      customerId: 'customer-123',
      orderId: ORDER_ID,
      paymentId: 'payment-1',
      deltaCents: -12500,
      balanceCents: 12500,
      type: 'PAYMENT',
      createdAt,
    };

    tx.order.findUnique.mockResolvedValue(existingOrder);
    tx.payment.findFirst.mockResolvedValue(null);
    tx.payment.create.mockResolvedValue(paymentRecord);
    tx.payment.findMany.mockResolvedValue([paymentRecord]);
    tx.customer.update.mockResolvedValue(updatedCustomer);
    tx.customerLedgerEntry.create.mockResolvedValue(ledgerEntry);
    tx.order.update.mockResolvedValue(updatedOrder);

    const result = await upsertOrderPayment(
      ORDER_ID,
      {
        method: 'credit_card',
        amountCents: 12500,
        status: PaymentStatus.PAID,
      },
      USER_ID
    );

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: ORDER_ID,
        method: 'CREDIT_CARD',
        status: PaymentStatus.PAID,
      }),
    });
    expect(result.order).toEqual(updatedOrder);
    expect(result.payment).toEqual(paymentRecord);
    expect(result.payments).toEqual([paymentRecord]);
  });

  it('updates the latest payment record when one exists', async () => {
    const existingOrder = {
      id: ORDER_ID,
      customerId: 'customer-123',
      paidAmountCents: 0,
      paymentStatus: PaymentStatus.PENDING,
      lastPaymentAt: null,
    };
    const existingPayment = {
      id: 'payment-1',
      orderId: ORDER_ID,
      method: 'CREDIT_CARD',
      amountCents: 5000,
      status: PaymentStatus.PENDING,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    };
    const updatedPayment = {
      ...existingPayment,
      amountCents: 15000,
      status: PaymentStatus.AUTHORIZED,
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    };
    const updatedOrder = {
      ...existingOrder,
      paidAmountCents: 15000,
      paymentStatus: PaymentStatus.AUTHORIZED,
      lastPaymentAt: updatedPayment.updatedAt,
    };

    const updatedCustomer = {
      id: 'customer-123',
      currentBalanceCents: 15000,
    };

    const ledgerEntry = {
      id: 'ledger-2',
      customerId: 'customer-123',
      orderId: ORDER_ID,
      paymentId: 'payment-1',
      deltaCents: -15000,
      balanceCents: 15000,
      type: 'PAYMENT',
      createdAt: updatedPayment.updatedAt,
    };

    tx.order.findUnique.mockResolvedValue(existingOrder);
    tx.payment.findFirst.mockResolvedValue(existingPayment);
    tx.payment.update.mockResolvedValue(updatedPayment);
    tx.payment.findMany.mockResolvedValue([updatedPayment]);
    tx.customer.update.mockResolvedValue(updatedCustomer);
    tx.customerLedgerEntry.create.mockResolvedValue(ledgerEntry);
    tx.order.update.mockResolvedValue(updatedOrder);

    const result = await upsertOrderPayment(
      ORDER_ID,
      {
        method: 'credit_card',
        amountCents: 15000,
        status: PaymentStatus.AUTHORIZED,
      },
      USER_ID
    );

    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: existingPayment.id },
      data: expect.objectContaining({
        method: 'CREDIT_CARD',
        amountCents: 15000,
        status: PaymentStatus.AUTHORIZED,
      }),
    });
    expect(result.order).toEqual(updatedOrder);
    expect(result.payment).toEqual(updatedPayment);
    expect(result.payments).toEqual([updatedPayment]);
  });

  it('rejects invalid payment status values before touching the database', async () => {
    const existingOrder = {
      id: ORDER_ID,
      customerId: 'customer-123',
      paidAmountCents: 0,
      paymentStatus: PaymentStatus.PENDING,
      lastPaymentAt: null,
    };

    tx.order.findUnique.mockResolvedValue(existingOrder);
    tx.payment.findFirst.mockResolvedValue(null);

    await expect(
      upsertOrderPayment(
        ORDER_ID,
        {
          method: 'wire',
          amountCents: 1000,
          status: 'DRAFT' as PaymentStatus,
        },
        USER_ID
      )
    ).rejects.toBeInstanceOf(DomainError);

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.payment.update).not.toHaveBeenCalled();
  });

  it('rejects invalid payment methods before persisting payment records', async () => {
    const existingOrder = {
      id: ORDER_ID,
      customerId: 'customer-123',
      paidAmountCents: 0,
      paymentStatus: PaymentStatus.PENDING,
      lastPaymentAt: null,
    };

    tx.order.findUnique.mockResolvedValue(existingOrder);
    tx.payment.findFirst.mockResolvedValue(null);

    await expect(
      upsertOrderPayment(
        ORDER_ID,
        {
          method: 'credit-card',
          amountCents: 1000,
          status: PaymentStatus.PAID,
        },
        USER_ID
      )
    ).rejects.toBeInstanceOf(DomainError);

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.payment.update).not.toHaveBeenCalled();
  });
});

describe('addManualPayment', () => {
  const tx = prismaTxMock.tx;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults manual payment status to PAID when omitted', async () => {
    const createdAt = new Date('2024-01-05T00:00:00.000Z');
    const order = {
      id: ORDER_ID,
      number: 'ORD-000123',
      customerId: 'customer-123',
      paidAmountCents: 0,
      paymentStatus: PaymentStatus.PENDING,
    };
    const payment = {
      id: 'payment-manual-1',
      orderId: ORDER_ID,
      method: 'CASH',
      amountCents: 5000,
      status: PaymentStatus.PAID,
      createdAt,
      updatedAt: createdAt,
    };

    tx.order.findUnique.mockResolvedValue(order);
    tx.payment.create.mockResolvedValue(payment);
    tx.payment.findMany.mockResolvedValue([payment]);
    tx.order.update.mockResolvedValue({
      ...order,
      paidAmountCents: 5000,
      paymentStatus: PaymentStatus.PAID,
      lastPaymentAt: createdAt,
    });
    tx.customer.update.mockResolvedValue({ id: 'customer-123', currentBalanceCents: 5000 });
    tx.customerLedgerEntry.create.mockResolvedValue({ id: 'ledger-manual-1' });

    const result = await addManualPayment(
      ORDER_ID,
      {
        method: 'cash',
        amountCents: 5000,
      },
      USER_ID
    );

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: ORDER_ID,
        method: 'CASH',
        status: PaymentStatus.PAID,
      }),
    });
    expect(result).toEqual(payment);
  });
});
