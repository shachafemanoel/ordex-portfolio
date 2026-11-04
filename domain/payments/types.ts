/**
 * Payments Domain Type Header
 *
 * This file serves as the central type definition hub for the payments domain.
 * All payment-related types should be imported from this file.
 */

// Core PaymentStatus from Prisma
export type { PaymentStatus } from '@prisma/client';

// Re-export all payment-related types
export type { PaymentCreateInput, PaymentDTO } from '@/domain/payments';

// Re-export normalization utilities
export { normalizePayment, normalizePayments } from '@/domain/payments/normalizePayment';
