import { expect, it } from 'vitest';
import { describeIfDatabase } from './helpers/db';

describeIfDatabase('customers api', () => {
  it('creates and lists', async () => {
    const { POST, GET } = await import('@/app/api/customers/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'לקוח', email: 'client@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const list = await GET(new Request('http://localhost'));
    const data = await list.json();
    expect(Array.isArray(data.data.items)).toBe(true);
    expect(data.data.items.length).toBeGreaterThan(0);
  });
});
