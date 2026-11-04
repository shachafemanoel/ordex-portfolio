import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock('@/lib/auth/withAuthApiRoute', () => ({
  withAuthApiRoute: (handler: any) => handler,
}));

describe('POST /api/users/:id/token', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  it('generates a new token for an active user', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'target-user-id',
      email: 'user@example.com',
      name: 'Test User',
      role: 'SALES',
      isActive: true,
    });
    mockUpdate.mockResolvedValue({
      id: 'target-user-id',
      apiToken: 'new-token',
    });

    const { POST } = await import('@/app/api/users/[id]/token/route');

    const request = new Request('http://localhost/api/users/target-user-id/token', {
      method: 'POST',
    }) as unknown as NextRequest;

    // Simulate authenticated admin user making the request
    const adminUser = { id: 'admin-id', role: 'ADMIN', permissions: [] } as any;

    const response = await POST(request, adminUser, { params: { id: 'target-user-id' } });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'target-user-id' },
      data: { apiToken: expect.any(String) },
    });
  });

  it('returns 404 if user not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/users/[id]/token/route');
    const request = new Request('http://localhost/api/users/missing-id/token', {
      method: 'POST',
    }) as unknown as NextRequest;

    const adminUser = { id: 'admin-id', role: 'ADMIN', permissions: [] } as any;

    const response = await POST(request, adminUser, { params: { id: 'missing-id' } });
    expect(response.status).toBe(404);
  });

  it('returns 400 if user is inactive', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'inactive-id',
      isActive: false,
    });

    const { POST } = await import('@/app/api/users/[id]/token/route');
    const request = new Request('http://localhost/api/users/inactive-id/token', {
      method: 'POST',
    }) as unknown as NextRequest;

    const adminUser = { id: 'admin-id', role: 'ADMIN', permissions: [] } as any;

    const response = await POST(request, adminUser, { params: { id: 'inactive-id' } });
    expect(response.status).toBe(400);
  });
});
