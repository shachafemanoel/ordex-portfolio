import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setAdminPassword } from '../../scripts/set-admin-password';

// Mock process.env
const originalEnv = process.env;

// Mock dependencies
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockHashPassword = vi.fn();
const mockDisconnect = vi.fn();

// Mock console to avoid cluttering test output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
    $disconnect: (...args: any[]) => mockDisconnect(...args),
  },
}));

vi.mock('@/lib/auth', () => ({
  hashPassword: (...args: any[]) => mockHashPassword(...args),
}));

describe('setAdminPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw an error if ADMIN_EMAIL is missing', async () => {
    delete process.env.ADMIN_EMAIL;
    process.env.ADMIN_PASSWORD = 'password123';

    await expect(setAdminPassword()).rejects.toThrow('ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set');
  });

  it('should throw an error if ADMIN_PASSWORD is missing', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';
    delete process.env.ADMIN_PASSWORD;

    await expect(setAdminPassword()).rejects.toThrow('ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set');
  });

  it('should throw an error if user is not found', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.ADMIN_PASSWORD = 'password123';
    mockFindUnique.mockResolvedValue(null);

    await expect(setAdminPassword()).rejects.toThrow('User not found!');
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { email: 'admin@example.com' } });
  });

  it('should update the password if user exists', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.ADMIN_PASSWORD = 'password123';
    mockFindUnique.mockResolvedValue({ id: 'user1', email: 'admin@example.com' });
    mockHashPassword.mockResolvedValue('hashed_password123');
    mockUpdate.mockResolvedValue({ id: 'user1', email: 'admin@example.com', password: 'hashed_password123' });

    await setAdminPassword();

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { email: 'admin@example.com' } });
    expect(mockHashPassword).toHaveBeenCalledWith('password123');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
      data: { password: 'hashed_password123' },
    });
    expect(mockConsoleLog).toHaveBeenCalledWith('Password set successfully.');
  });
});
