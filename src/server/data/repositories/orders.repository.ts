import { Prisma } from '@prisma/client';
import { prisma } from '@/src/server/data/prisma';

export class OrdersRepository {
  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            supplier: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                imageUrl: true,
              },
            },
          },
        },
        customer: true,
        shippingAddress: true,
      },
    });
  }

  async findMany(filters: Prisma.OrderFindManyArgs = {}) {
    return prisma.order.findMany(filters);
  }

  async count(where: Prisma.OrderWhereInput = {}) {
    return prisma.order.count({ where });
  }

  async create(data: Prisma.OrderCreateArgs['data']) {
    return prisma.order.create({
      data,
    });
  }

  async update(id: string, data: Prisma.OrderUpdateArgs['data']) {
    return prisma.order.update({
      where: { id },
      data,
    });
  }
}
