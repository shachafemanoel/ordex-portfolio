import { beforeEach, describe, expect, it, vi } from 'vitest';

const hashMock = vi.hoisted(() => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

const prismaUserMock = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/auth/hash', () => hashMock);
vi.mock('@/lib/prisma', () => ({ prisma: { user: prismaUserMock } }));

import { ensureDefaultAdminUser } from '@/lib/auth/default-admin';

describe('ensureDefaultAdminUser', () => {
  beforeEach(() => {
    prismaUserMock.findUnique.mockReset();
    prismaUserMock.create.mockReset();
    prismaUserMock.update.mockReset();
    hashMock.hashPassword.mockClear();
    delete process.env.DEFAULT_ADMIN_EMAIL;
    delete process.env.DEFAULT_ADMIN_NAME;
    delete process.env.DEFAULT_ADMIN_PASSWORD;
  });

  it('creates the default admin when none exists', async () => {
    prismaUserMock.findUnique.mockResolvedValueOnce(null);
    prismaUserMock.create.mockResolvedValueOnce({ id: 'user-1' });

    const result = await ensureDefaultAdminUser();

    expect(result).toEqual({
      userId: 'user-1',
      email: 'admin@ordex.local',
      created: true,
      updated: false,
      passwordReset: true,
    });

    expect(prismaUserMock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'admin@ordex.local',
        name: 'Ordex Administrator',
        password: 'hashed:ChangeMe123!',
        role: 'ADMIN',
        isActive: true,
      }),
      select: { id: true },
    });
    expect(hashMock.hashPassword).toHaveBeenCalledWith('ChangeMe123!');
  });

  it('updates existing admin missing critical fields', async () => {
    prismaUserMock.findUnique.mockResolvedValueOnce({
      id: 'user-2',
      name: '',
      role: 'SALES',
      isActive: false,
      password: null,
    });

    const result = await ensureDefaultAdminUser();

    expect(result).toEqual({
      userId: 'user-2',
      email: 'admin@ordex.local',
      created: false,
      updated: true,
      passwordReset: true,
    });

    expect(prismaUserMock.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: {
        password: 'hashed:ChangeMe123!',
        role: 'ADMIN',
        isActive: true,
        name: 'Ordex Administrator',
      },
    });
    expect(hashMock.hashPassword).toHaveBeenCalledWith('ChangeMe123!');
  });

  it('leaves existing admin untouched when already configured', async () => {
    prismaUserMock.findUnique.mockResolvedValueOnce({
      id: 'user-3',
      name: 'Existing Admin',
      role: 'ADMIN',
      isActive: true,
      password: 'hashed:existing',
    });

    const result = await ensureDefaultAdminUser();

    expect(result).toEqual({
      userId: 'user-3',
      email: 'admin@ordex.local',
      created: false,
      updated: false,
      passwordReset: false,
    });

    expect(prismaUserMock.update).not.toHaveBeenCalled();
    expect(hashMock.hashPassword).not.toHaveBeenCalled();
  });
});
