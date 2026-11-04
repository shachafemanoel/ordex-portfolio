import { it, expect } from 'vitest';
import { describeSequentialIfDatabase } from '../helpers/db';

const describeIfDatabase = describeSequentialIfDatabase;

describeIfDatabase('receipts permissions', () => {
  it('returns 401/403 when missing or wrong role', async () => {
    const { prisma } = await import('@/lib/prisma');
    const supplier = await prisma.supplier.create({ data: { name: 'Perm Supplier' } });

    const { POST } = await import('@/app/api/receipts/route');
    // Missing token
    const req1 = new Request('http://localhost/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplierId: supplier.id, poId: 'x', lines: [] }) });
    const res1 = await POST(req1 as any);
    expect(res1.status).toBeGreaterThanOrEqual(400);

    // SALES role should not have EDIT_PO_CREATEDS
    const sales = await prisma.user.create({ data: { id: 'sales1', email: 'sales@ordex.app', name: 'Sales', role: 'SALES' } });
    const req2 = new Request('http://localhost/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json', authorization: 'Bearer sales-token' }, body: JSON.stringify({ supplierId: supplier.id, poId: 'x', lines: [] }) });
    const res2 = await POST(req2 as any);
    expect(res2.status).toBe(403);
  });
});

