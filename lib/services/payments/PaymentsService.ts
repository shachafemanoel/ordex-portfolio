import {
  calculateOrderBalance,
  createPaymentPlan,
  getCustomerBalance,
  recordInstallment,
  recordPayment,
  refundPayment,
  type CreatePaymentPlanInput,
  type RecordInstallmentInput,
  type RecordPaymentInput,
  type RefundPaymentInput,
} from '@/lib/payments';

type LoggerLike = Partial<import('@/lib/logger').Logger>;

export class PaymentsService {
  constructor(
    private logger?: LoggerLike,
    private _auditService?: unknown
  ) {}

  async createPayment(input: RecordPaymentInput, actorId?: string) {
    this.logger?.info?.('PaymentsService.createPayment', {
      orderId: input.orderId,
      amountCents: input.amountCents,
    });
    return recordPayment(input, actorId);
  }

  async refundPayment(input: RefundPaymentInput, actorId?: string) {
    return refundPayment(input, actorId);
  }

  async createPaymentPlan(input: CreatePaymentPlanInput, actorId?: string) {
    return createPaymentPlan(input, actorId);
  }

  async recordInstallment(input: RecordInstallmentInput, actorId?: string) {
    return recordInstallment(input, actorId);
  }

  async getOrderBalance(orderId: string) {
    return calculateOrderBalance(orderId);
  }

  async getCustomerBalance(customerId: string) {
    return getCustomerBalance(customerId);
  }
}
