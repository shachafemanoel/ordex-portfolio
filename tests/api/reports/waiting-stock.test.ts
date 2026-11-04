import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// Mock auth wrapper to bypass authentication in tests
vi.mock('@/lib/api-middleware', async () => {
  const actual = await vi.importActual<any>('@/lib/api-middleware');
  return {
    ...actual,
    withAuth: (handler: any) => handler,
    AuthenticatedUser: {},
  };
});
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));
vi.mock('@/domain/orders/normalizeOrder', () => ({
  normalizeOrder: (order: any) => order,
}));

const describeFn = process.env.SKIP_DB_TESTS === 'true' ? describe.skip : describe;

describeFn('Waiting Stock report response shape', () => {
  const mockUser = {
    id: 'tester',
    role: 'ADMIN' as const,
    email: 'admin@example.com',
    name: 'Admin User',
  };

  it('returns canonical success response with nested collections', async () => {
    const { GET } = await import('@/app/api/reports/waiting-stock/route');
    const req = new NextRequest('http://localhost:3000/api/reports/waiting-stock');
    const res = await GET(req, mockUser as any);
    const json = await res.json();

    expect(json).toHaveProperty('success', true);
    expect(json).toHaveProperty('data');
    expect(Array.isArray(json.data.orders)).toBe(true);
    expect(Array.isArray(json.data.supplierStats)).toBe(true);
  });
});
