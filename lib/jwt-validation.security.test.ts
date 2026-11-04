
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JWTValidator } from './jwt-validation';

describe('JWTValidator Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('should throw an error when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long';

    expect(() => new JWTValidator()).toThrow(/JWT_SECRET/);
  });

  it('should throw an error when JWT_REFRESH_SECRET is missing', () => {
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
    delete process.env.JWT_REFRESH_SECRET;

    expect(() => new JWTValidator()).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('should initialize correctly when both secrets are provided', () => {
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long';

    expect(() => new JWTValidator()).not.toThrow();
  });
});
