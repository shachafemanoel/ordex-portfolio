import { Prisma } from '@prisma/client';
import { DomainError } from '@/lib/server/errors';

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true;
    customer: true;
    shippingAddress: true;
  };
}>;

export type OrderListItem = Prisma.OrderGetPayload<{}>;

export type OrderFilters = Prisma.OrderFindManyArgs;

export class OrderNotFoundError extends DomainError {
  constructor(orderId: string) {
    super('order_not_found', 404, { orderId });
  }
}
