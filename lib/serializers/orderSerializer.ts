import { normalizeOrder } from '@/domain/orders/normalizeOrder';
import type { OrderDTO } from '@/domain/orders/orderDTO';
import type { Prisma } from '@prisma/client';

export const ORDER_WITH_RELATIONS_INCLUDE = {
  customer: {
    include: {
      addresses: true,
    },
  },
  billingAddress: true,
  shippingAddress: true,
  items: {
    include: {
      product: {
        include: {
          defaultSupplier: true,
        },
      },
      supplier: true,
    },
  },
  payments: {
    orderBy: {
      updatedAt: 'desc',
    },
  },
  assignedUser: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  _count: {
    select: {
      noteEntries: true,
    },
  },
  labels: true,
} as const;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof ORDER_WITH_RELATIONS_INCLUDE;
}>;

export function serializeOrder(order: OrderWithRelations): OrderDTO {
  return normalizeOrder(order);
}

export type { OrderWithRelations };
