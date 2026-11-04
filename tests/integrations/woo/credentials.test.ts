import { beforeAll, describe, expect, it } from 'vitest';
import { maskKey, newWebhookSecret, openCredentials, sealCredentials } from '@/lib/integrations/woocommerce/credentials';

const credentials = {
  consumerKey: 'ck_' + '1'.repeat(40),
  consumerSecret: 'cs_' + '2'.repeat(40),
  webhookSecret: newWebhookSecret(),
};

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'f'.repeat(64);
});

describe('store credentials', () => {
  it('are stored encrypted and read back intact', () => {
    const sealed = sealCredentials(credentials);
    const stored = JSON.stringify(sealed);
    expect(stored).not.toContain(credentials.consumerKey);
    expect(stored).not.toContain(credentials.consumerSecret);
    expect(stored).not.toContain(credentials.webhookSecret);
    expect(openCredentials(JSON.parse(stored))).toEqual(credentials);
  });

  it('cannot be read after tampering, or when nothing was stored', () => {
    const sealed = sealCredentials(credentials);
    const flipped = Buffer.from(sealed.cipher, 'base64');
    flipped[0] ^= 1;
    expect(() => openCredentials({ ...sealed, cipher: flipped.toString('base64') })).toThrow();
    expect(openCredentials({})).toBeNull();
    expect(openCredentials(null)).toBeNull();
  });

  it('creates a new random webhook secret each time', () => {
    const secret = newWebhookSecret();
    expect(secret).not.toBe(newWebhookSecret());
    expect(Buffer.from(secret, 'base64url')).toHaveLength(32);
  });

  it('shows only the last four characters of a key', () => {
    expect(maskKey('ck_abcdef1234')).toBe('••••1234');
  });
});
