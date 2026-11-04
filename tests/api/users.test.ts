import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      create: mockCreate,
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}));

vi.mock('@/lib/auth/withAuthApiRoute', () => ({
  withAuthApiRoute: (handler: any) => handler,
}));

describe('POST /api/users', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockCreate.mockReset();
    mockFindMany.mockReset();
    mockCount.mockReset();
  });

  it('stores a hashed password when creating a user', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockImplementation(async ({ data }) => ({
      id: 'user-123',
      email: data.email,
      name: data.name,
      role: data.role,
      isActive: true,
      password: data.password,
      _count: { assignedOrders: 0 },
      createdAt: new Date(),
    }));

    const { POST } = await import('@/app/api/users/route');

    const request = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Admin User',
        email: 'new.user@example.com',
        role: 'ADMIN',
        password: 'Password123',
      }),
    }) as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user).toBeDefined();

    const savedData = mockCreate.mock.calls[0][0].data;
    expect(typeof savedData.password).toBe('string');
    expect(savedData.password).not.toBe('Password123');
    expect(savedData.password).toMatch(/^\$2[aby]\$/);
    expect(savedData.password.length).toBeGreaterThan(20);
  });
});
