import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  getPrismaClient: () => ({
    order: { findMany: mockFindMany },
  }),
}));

vi.mock('@/lib/api-middleware', () => ({
  withAuth:
    (handler: (req: NextRequest, user: unknown, ...args: unknown[]) => unknown) =>
    async (req: NextRequest, ...args: unknown[]) =>
      handler(
        req,
        { id: 'test-user', email: 'test@example.com', role: 'ADMIN', permissions: [] },
        ...args
      ),
}));

describe('/api/orders/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns UTF-8 CSV of recent orders (no ids query)', async () => {
    mockFindMany.mockResolvedValue([
      {
        number: 'ORD-1',
        status: 'RECEIVED',
        customerName: 'Csv Test',
        customerPhone: '+972501234567',
        customerEmail: 'a@b.com',
        totalCents: 5000,
        currency: 'ILS',
        createdAt: new Date('2020-01-01T12:00:00.000Z'),
        city: 'Tel Aviv',
        addressLine: 'Main 1',
      },
    ]);

    const { GET } = await import('@/app/api/orders/export/route');
    const res = await GET(new NextRequest('http://localhost/api/orders/export'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    const body = text.replace(/^\uFEFF/, '');
    expect(body).toMatch(/^number,/);
    expect(text).toContain('Csv Test');
    expect(text).toContain('ORD-1');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        take: 5000,
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});
