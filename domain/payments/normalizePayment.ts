/**
 * Payment normalization utilities
 * Ensures consistent payment data structure across the application
 */

export interface PaymentDTO {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  paidAt: string;
  reference?: string | null;
  status: string;
  createdAt?: string;
}

// Payment method normalization
const PAYMENT_METHOD_MAP: Record<string, string> = {
  card: 'CARD',
  credit_card: 'CARD',
  cash: 'CASH',
  bank_transfer: 'BANK_TRANSFER',
  check: 'CHECK',
  cheque: 'CHECK',
  paypal: 'PAYPAL',
  other: 'OTHER',
};

/**
 * Normalizes a payment method string
 */
function normalizePaymentMethod(method: string | undefined | null): string {
  if (!method) return 'OTHER';
  const lower = method.toLowerCase().trim();
  return PAYMENT_METHOD_MAP[lower] || method.toUpperCase();
}

/**
 * Normalizes a payment object from various sources (Prisma, API, legacy)
 */
export function normalizePayment(payment: any): PaymentDTO | null {
  if (!payment || !payment.id) return null;

  // Extract order ID (handle both camelCase and snake_case)
  const orderId = payment.orderId || payment.order_id || '';

  // Extract amount (handle cents conversion)
  let amount = 0;
  if (payment.amount !== undefined) {
    amount = Number(payment.amount);
  } else if (payment.amountCents !== undefined) {
    amount = Number(payment.amountCents) / 100;
  } else if (payment.amount_cents !== undefined) {
    amount = Number(payment.amount_cents) / 100;
  }

  // Normalize payment method
  const method = normalizePaymentMethod(payment.method || payment.paymentMethod);

  // Extract payment date
  const paidAt = payment.paidAt
    ? new Date(payment.paidAt).toISOString()
    : payment.paid_at
      ? new Date(payment.paid_at).toISOString()
      : new Date().toISOString();

  // Extract reference (handle various field names)
  const reference =
    payment.reference ||
    payment.externalId ||
    payment.external_id ||
    payment.transactionId ||
    payment.transaction_id ||
    null;

  // Extract status
  const status = payment.status || 'COMPLETED';

  // Extract created date
  const createdAt = payment.createdAt
    ? new Date(payment.createdAt).toISOString()
    : payment.created_at
      ? new Date(payment.created_at).toISOString()
      : paidAt;

  return {
    id: payment.id,
    orderId,
    amount,
    method,
    paidAt,
    reference,
    status,
    createdAt,
  };
}

/**
 * Normalizes an array of payments
 */
export function normalizePayments(payments: any[]): PaymentDTO[] {
  if (!Array.isArray(payments)) return [];
  return payments.map(normalizePayment).filter((p): p is PaymentDTO => p !== null);
}
