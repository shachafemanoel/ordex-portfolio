import { expect, it } from 'vitest';
import { describeIfDatabase } from './helpers/db';

describeIfDatabase('purchase report api', () => {
  it('aggregates items by supplier + SKU', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { GET } = await import('@/app/api/reports/purchase/route');

    // Seed supplier, sku, order, items
    const supplier = await prisma.supplier.create({ data: { name: 'Supplier A' } });
    const sku = await prisma.sku.create({
      data: { code: 'SKU1', name: 'Widget', supplierId: supplier.id },
    });
    const order = await prisma.order.create({
      data: {
        number: 9999,
        customerName: 'Tester',
        totalAmount: 100,
        address: 'Street 1',
        status: 'PO',
        items: {
          create: [
            { productId: sku.id, qty: 2, received: false },
            { productId: sku.id, qty: 3, received: true },
          ],
        },
      },
      include: { items: true },
    });

    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const row = data.find((r: any) => r.skuCode === 'SKU1');
    expect(row).toBeTruthy();
    expect(row.totalQty).toBe(5);
    expect(row.receivedQty).toBe(3);
    expect(row.pendingQty).toBe(2);
  });
});
