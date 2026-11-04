import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isBlockedAddress, normalizeStoreUrl, privateHostsAllowed, StoreAddressError } from '@/lib/integrations/woocommerce/store-address';

const env = { ...process.env };
beforeEach(() => {
  delete process.env.WOO_ALLOW_PRIVATE_HOSTS;
});
afterEach(() => {
  process.env = { ...env };
});

describe('normalizeStoreUrl', () => {
  it('accepts what people type and returns the store root', () => {
    expect(normalizeStoreUrl('shop.example.co.il/').toString()).toBe('https://shop.example.co.il/');
    expect(normalizeStoreUrl(' https://shop.example.co.il/he/?a=1#x ').toString()).toBe('https://shop.example.co.il/he');
  });

  it.each([
    'http://shop.example.co.il',
    'ftp://shop.example.co.il',
    'https://user:pass@shop.example.co.il',
    'https://127.0.0.1',
    'https://169.254.169.254',
    'https://[::1]',
    'not a url at all ::',
  ])('refuses %s', (input) => {
    expect(() => normalizeStoreUrl(input)).toThrow(StoreAddressError);
  });
});

describe('isBlockedAddress', () => {
  it.each(['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.20.0.5', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1'])(
    'blocks %s',
    (address) => expect(isBlockedAddress(address)).toBe(true)
  );

  it.each(['93.184.216.34', '2606:2800:220:1::1'])('allows public %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe('privateHostsAllowed', () => {
  it('is off unless explicitly enabled, and never in production', () => {
    delete process.env.WOO_ALLOW_PRIVATE_HOSTS;
    expect(privateHostsAllowed()).toBe(false);
    process.env.WOO_ALLOW_PRIVATE_HOSTS = 'true';
    process.env.APP_ENV = 'test';
    expect(privateHostsAllowed()).toBe(true);
    process.env.APP_ENV = 'production';
    expect(privateHostsAllowed()).toBe(false);
  });
});
