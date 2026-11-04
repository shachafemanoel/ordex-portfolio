import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { randomBytes } from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';

describe('crypto', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
  });

  it('encrypts and decrypts', () => {
    const { cipher, iv, tag } = encryptSecret('secret');
    const dec = decryptSecret(cipher, iv, tag);
    expect(dec).toBe('secret');
  });

  it('fails on auth tag mismatch', () => {
    const { cipher, iv, tag } = encryptSecret('secret');
    const badTag = Buffer.from(tag);
    badTag[0] ^= 1;
    expect(() => decryptSecret(cipher, iv, badTag)).toThrow();
  });
});
