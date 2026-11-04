import { createHmac } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  integration: null as Record<string, unknown> | null,
  executeRaw: vi.fn(),
  updateIntegration: vi.fn(),
  identityLookups: 0,
}));

vi.mock('@/lib/db', () => ({
  withIdentityDatabase: async (action: (tx: unknown) => unknown) => {
    db.identityLookups += 1;
    return action({ wooIntegration: { findUnique: async () => db.integration } });
  },
  prisma: {
    $transaction: async (action: (tx: unknown) => unknown) =>
      action({ $executeRaw: db.executeRaw, wooIntegration: { update: db.updateIntegration } }),
  },
}));
vi.mock('@/lib/tenancy/context', () => ({
  withTenantContext: async (_context: unknown, action: () => unknown) => action(),
}));

import { sealCredentials } from '@/lib/integrations/woocommerce/credentials';
import { receiveStoreEvent } from '@/lib/integrations/woocommerce/receiver';

const INTEGRATION_ID = '6f1d8f0e-3f7a-4c1b-9b7e-2a5d4c3b2a10';
const SECRET = 'test-webhook-secret';

const order = { id: 1234, status: 'processing', date_modified_gmt: '2026-10-29T08:00:00', billing: { phone: '0521234567' } };

function delivery(body: unknown, options: { topic?: string; secret?: string; contentType?: string } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const headers = new Headers({
    'content-type': options.contentType ?? 'application/json',
    'x-wc-webhook-topic': options.topic ?? 'order.created',
    'x-wc-webhook-signature': createHmac('sha256', options.secret ?? SECRET).update(raw).digest('base64'),
  });
  return { integrationId: INTEGRATION_ID, headers, rawBody: Buffer.from(raw) };
}

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'e'.repeat(64);
});

beforeEach(() => {
  db.integration = {
    id: INTEGRATION_ID,
    tenantId: 'tenant-a',
    enabled: true,
    status: 'CONNECTED',
    serviceUserId: 'service-user',
    credentials: sealCredentials({ consumerKey: 'ck_x', consumerSecret: 'cs_x', webhookSecret: SECRET }),
  };
  db.executeRaw.mockReset().mockResolvedValue(1);
  db.updateIntegration.mockReset();
  db.identityLookups = 0;
});

describe('receiveStoreEvent', () => {
  it('answers the ping a store sends when a webhook is created, without storing anything', async () => {
    const result = await receiveStoreEvent(delivery('webhook_id=101', { contentType: 'application/x-www-form-urlencoded' }));
    expect(result).toEqual({ status: 200, outcome: 'ping' });
    expect(db.identityLookups).toBe(0);
  });

  it('stores a signed order event once, keyed by order and modification time', async () => {
    const result = await receiveStoreEvent(delivery(order));
    expect(result).toEqual({ status: 200, outcome: 'stored' });
    const [, jobCall] = db.executeRaw.mock.calls;
    expect(jobCall.slice(1)).toEqual(expect.arrayContaining(['1234', 'order.created', 'order:1234:2026-10-29T08:00:00']));
    expect(db.updateIntegration).toHaveBeenCalledWith({ where: { id: INTEGRATION_ID }, data: { lastEventAt: expect.any(Date) } });
  });

  it('reports a repeated delivery as a duplicate', async () => {
    db.executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect(await receiveStoreEvent(delivery(order))).toEqual({ status: 200, outcome: 'duplicate' });
  });

  it('rejects a wrong signature, including one made with another business secret, and stores nothing', async () => {
    expect(await receiveStoreEvent(delivery(order, { secret: 'another-business-secret' }))).toEqual({ status: 401, outcome: 'bad_signature' });
    const tampered = delivery(order);
    tampered.rawBody = Buffer.from(JSON.stringify({ ...order, total: '1.00' }));
    expect((await receiveStoreEvent(tampered)).outcome).toBe('bad_signature');
    expect(db.executeRaw).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown, disconnected or malformed integration', async () => {
    expect((await receiveStoreEvent({ ...delivery(order), integrationId: 'not-a-uuid' })).status).toBe(404);
    db.integration = { ...db.integration!, status: 'DISABLED' };
    expect((await receiveStoreEvent(delivery(order))).status).toBe(404);
    db.integration = null;
    expect((await receiveStoreEvent(delivery(order))).status).toBe(404);
  });

  it('accepts and ignores topics other than order events', async () => {
    expect(await receiveStoreEvent(delivery({ id: 9 }, { topic: 'product.updated' }))).toEqual({ status: 200, outcome: 'ignored_topic' });
    expect(db.executeRaw).not.toHaveBeenCalled();
  });

  it('rejects a signed payload that is not an order', async () => {
    expect((await receiveStoreEvent(delivery({ hello: 'world' }))).outcome).toBe('bad_payload');
    expect((await receiveStoreEvent(delivery('not json'))).outcome).toBe('bad_payload');
  });
});
