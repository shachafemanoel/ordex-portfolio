export * from '@/domain/payments/normalizePayment';

import { PaymentStatus } from '@prisma/client';

export interface PaymentCreateInput {
  orderId: string;
  amountCents: number;
  method: import('@prisma/client').PaymentMethod;
  reference?: string;
  status?: PaymentStatus;
  paidAt?: string | Date;
  notes?: string;
}
