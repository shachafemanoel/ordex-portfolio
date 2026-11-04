import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createWebhook, deleteWebhook, StoreError, testStore } from '@/lib/integrations/woocommerce/store-client';
import { startMockStore } from '../../support/wooMockStore';

let store: Awaited<ReturnType<typeof startMockStore>>;
const env = { ...process.env };

beforeAll(async () => {
  store = await startMockStore();
});
afterAll(() => store.close());
afterEach(() => {
  process.env = { ...env };
});

const allowLocal = () => {
  process.env.WOO_ALLOW_PRIVATE_HOSTS = 'true';
  process.env.APP_ENV = 'test';
};

describe('store client', () => {
  it('reads orders with valid keys', async () => {
    allowLocal();
    await expect(testStore(new URL(store.url), store.keys)).resolves.toBeUndefined();
  });

  it('explains wrong keys and a missing store in Hebrew', async () => {
    allowLocal();
    await expect(testStore(new URL(store.url), { ...store.keys, consumerSecret: 'cs_wrong' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: expect.stringContaining('המפתחות'),
    });
    await expect(testStore(new URL(`${store.url}/not-a-store`), store.keys)).rejects.toMatchObject({ code: 'NOT_WOOCOMMERCE' });
  });

  it('refuses to connect to a private address unless explicitly allowed outside production', async () => {
    delete process.env.WOO_ALLOW_PRIVATE_HOSTS;
    await expect(testStore(new URL(store.url), store.keys)).rejects.toMatchObject({ code: 'INVALID_ADDRESS' });
    // A name that resolves to a private address is refused at connection time.
    await expect(testStore(new URL(store.url.replace('127.0.0.1', 'localhost')), store.keys)).rejects.toMatchObject({ code: 'INVALID_ADDRESS' });

    allowLocal();
    process.env.APP_ENV = 'production';
    await expect(testStore(new URL(store.url), store.keys)).rejects.toMatchObject({ code: 'INVALID_ADDRESS' });
  });

  it('does not follow redirects', async () => {
    allowLocal();
    const redirecting = http.createServer((_req, res) => {
      res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
      res.end();
    });
    await new Promise<void>((resolve) => redirecting.listen(0, '127.0.0.1', resolve));
    const { port } = redirecting.address() as AddressInfo;
    try {
      await expect(testStore(new URL(`http://127.0.0.1:${port}`), store.keys)).rejects.toBeInstanceOf(StoreError);
    } finally {
      redirecting.close();
    }
  });

  it('creates and deletes webhooks, and deleting one that is gone succeeds', async () => {
    allowLocal();
    const id = await createWebhook(new URL(store.url), store.keys, { topic: 'order.created', deliveryUrl: 'https://retzef.example/api/webhooks/woocommerce/x', secret: 's' });
    expect(store.webhooks.get(id)?.topic).toBe('order.created');
    await deleteWebhook(new URL(store.url), store.keys, id);
    expect(store.webhooks.has(id)).toBe(false);
    await expect(deleteWebhook(new URL(store.url), store.keys, id)).resolves.toBeUndefined();
  });
});
