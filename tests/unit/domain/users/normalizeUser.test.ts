import { describe, it, expect } from 'vitest';
import { normalizeUser } from '@/domain/users/normalizeUser';

describe('normalizeUser', () => {
  it('should normalize user with string role', () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      role: 'ADMIN'
    };
    const normalized = normalizeUser(user);
    expect(normalized?.role.key).toBe('ADMIN');
  });

  it('should normalize user with role object containing key', () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      role: { key: 'SALES' }
    };
    const normalized = normalizeUser(user);
    expect(normalized?.role.key).toBe('SALES');
  });

  it('should normalize user with role object containing name', () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      role: { name: 'PURCHASING' }
    };
    const normalized = normalizeUser(user);
    expect(normalized?.role.key).toBe('PURCHASING');
  });

  it('should normalize user with role object containing id', () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      role: { id: 'INSTALLER' }
    };
    const normalized = normalizeUser(user);
    expect(normalized?.role.key).toBe('INSTALLER');
  });
});
