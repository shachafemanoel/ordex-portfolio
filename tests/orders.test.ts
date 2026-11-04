import { expect, it } from 'vitest';
import { describeSequentialIfDatabase } from './helpers/db';

let orderId: string;

const describeIfDatabase = describeSequentialIfDatabase;

describeIfDatabase('orders api', () => {
  it('creates, lists, and handles transitions', async () => {
    // Create test user to satisfy foreign key constraint
    const { prisma } = await import('@/lib/prisma');
    await prisma.user.create({
      data: {
        id: '1',
        email: 'admin@ordex.app',
        name: 'Admin User',
        role: 'ADMIN',
      },
    });

    const { POST, GET } = await import('@/app/api/orders/route');
    const { PATCH } = await import('@/app/api/orders/[id]/status/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        customerName: 'Test Customer',
        totalAmount: 100,
        address: '123 Test Street',
        items: [{ qty: 1 }], // No skuId should be allowed
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const created = await res.json();
    orderId = created.data.id;
    const list = await GET(
      new Request('http://localhost?status=NEW', {
        headers: { authorization: 'Bearer admin-token' },
      })
    );
    const data = await list.json();
    expect(data.data?.length || 0).toBeGreaterThan(0);
    const good = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ status: 'SCHEDULE', installAt: new Date().toISOString() }),
      }),
      { params: { id: orderId } }
    );
    expect(good.status).toBe(200);
    const bad = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ status: 'NEW' }),
      }),
      { params: { id: orderId } }
    );
    expect(bad.status).toBe(400);
  });
});
