import { DomainError } from '@/lib/server/errors';

// PaymentStatus was removed from Prisma schema; define locally
const PaymentStatus = {
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIAL: 'PARTIAL',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

const PAYMENT_STATUS_VALUES = new Set<PaymentStatus>(Object.values(PaymentStatus) as PaymentStatus[]);

function formatContext(context?: string) {
  return context ? ` (${context})` : '';
}

/**
 * Ensures the provided value is a valid PaymentStatus.
 * Accepts case-insensitive strings, but rejects any value outside the enum.
 */
export function assertPaymentStatus(status: unknown, context?: string): PaymentStatus {
  if (typeof status === 'string') {
    const normalized = status.trim().toUpperCase();
    if (PAYMENT_STATUS_VALUES.has(normalized as PaymentStatus)) {
      return normalized as PaymentStatus;
    }
  }

  console.warn(`[payments] Invalid payment status "${status}"${formatContext(context)}`);
  throw new DomainError('invalid_payment_status', 400, {
    status,
    allowed: Array.from(PAYMENT_STATUS_VALUES.values()),
    ...(context ? { context } : {}),
  });
}
