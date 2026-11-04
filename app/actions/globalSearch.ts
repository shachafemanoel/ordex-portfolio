'use server';

import { prisma } from '@/lib/db';

export type GlobalSearchResult = {
  type: 'order' | 'customer';
  id: string;
  title: string;
  subtitle: string;
  url: string;
};

export async function globalSearch(query: string): Promise<GlobalSearchResult[]> {
  if (!query || query.length < 2) return [];

  const results: GlobalSearchResult[] = [];

  try {
    // Search Orders
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { number: { contains: query, mode: 'insensitive' } },
          { customerName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        customerName: true,
        status: true,
      },
    });

    orders.forEach((order) => {
      results.push({
        type: 'order',
        id: order.id,
        title: order.number,
        subtitle: `${order.customerName || 'ללא שם'} • ${order.status}`,
        url: `/orders/${order.id}`,
      });
    });

    // Search Customers
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
    });

    customers.forEach((customer) => {
      results.push({
        type: 'customer',
        id: customer.id,
        title: customer.name || 'לא ידוע',
        subtitle: customer.phone || customer.email || '',
        url: `/customers/${customer.id}`,
      });
    });
  } catch (error) {
    console.error('Global search error:', error);
    // Return empty results on error
    return [];
  }

  return results;
}
