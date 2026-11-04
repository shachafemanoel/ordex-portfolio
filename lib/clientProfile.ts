import { prisma } from '@/lib/db';

export type ClientProfile = {
  client: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    createdAt: Date;
  } | null;
  stats: {
    totalOrders: number;
    totalSpend: number;
    firstOrderAt?: Date | null;
    lastOrderAt?: Date | null;
    tenureDays: number;
  };
};

export async function getClientProfile(clientId: string): Promise<ClientProfile> {
  // Note: Using Customer model (not Client) to match Prisma schema
  const client = await prisma.customer.findUnique({
    where: { id: clientId },
    include: {
      addresses: {
        where: { type: 'BILLING' },
        take: 1,
      }
    }
  });

  if (!client) {
    return {
      client: null,
      stats: { totalOrders: 0, totalSpend: 0, firstOrderAt: null, lastOrderAt: null, tenureDays: 0 },
    };
  }

  const [agg, first, last] = await Promise.all([
    prisma.order.aggregate({
      where: { customerId: clientId }, // Fixed: customerId instead of clientId
      _count: { id: true },
      _sum: { totalCents: true }, // Fixed: totalCents instead of totalAmount
    }),
    prisma.order.findFirst({
      where: { customerId: clientId }, // Fixed: customerId instead of clientId
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true }
    }),
    prisma.order.findFirst({
      where: { customerId: clientId }, // Fixed: customerId instead of clientId
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
  ]);

  const totalOrders = agg._count.id || 0;
  const totalSpend = agg._sum.totalCents || 0; // Fixed: totalCents
  const firstOrderAt = first?.createdAt || null;
  const lastOrderAt = last?.createdAt || null;
  const base = firstOrderAt || client.createdAt;
  const tenureDays = Math.max(0, Math.floor((Date.now() - base.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      city: client.addresses[0]?.city || null, // Fixed: city is in Address model
      createdAt: client.createdAt,
    },
    stats: { totalOrders, totalSpend, firstOrderAt, lastOrderAt, tenureDays },
  };
}

