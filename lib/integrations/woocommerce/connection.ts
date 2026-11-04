import { ApiError } from '@/lib/api-middleware';
import { prisma, withIdentityDatabase } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenancy/context';
import {
  maskKey,
  newWebhookSecret,
  openCredentials,
  sealCredentials,
  type WooCredentials,
} from './credentials';
import { normalizeStoreUrl } from './store-address';
import {
  createWebhook,
  deleteWebhook,
  getWebhookStatus,
  ORDER_TOPICS,
  StoreError,
  testStore,
  type StoreKeys,
} from './store-client';

export type IntegrationStatus = 'NOT_CONNECTED' | 'CONNECTED' | 'ERROR' | 'DISABLED';

/** Everything the screen may know about the connection. Never keys or secrets. */
export interface WooConnectionView {
  status: IntegrationStatus;
  storeUrl: string | null;
  consumerKey: string | null;
  webhookCount: number;
  lastEventAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
}

export interface ConnectInput {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

function webhookIdsOf(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
}

export function deliveryUrlFor(integrationId: string): string {
  const base = process.env.APP_URL;
  if (!base) throw new Error('APP_URL is required to receive store events');
  return new URL(`/api/webhooks/woocommerce/${integrationId}`, base).toString();
}

export async function getConnection(): Promise<WooConnectionView> {
  const integration = await prisma.wooIntegration.findFirst();
  if (!integration) {
    return {
      status: 'NOT_CONNECTED',
      storeUrl: null,
      consumerKey: null,
      webhookCount: 0,
      lastEventAt: null,
      lastError: null,
      connectedAt: null,
    };
  }
  const credentials =
    integration.status === 'DISABLED' ? null : openCredentials(integration.credentials);
  return {
    status: integration.status as IntegrationStatus,
    storeUrl: integration.baseUrl,
    consumerKey: credentials ? maskKey(credentials.consumerKey) : null,
    webhookCount: webhookIdsOf(integration.webhookIds).length,
    lastEventAt: integration.lastEventAt?.toISOString() ?? null,
    lastError: integration.lastError,
    connectedAt: integration.status === 'CONNECTED' ? integration.updatedAt.toISOString() : null,
  };
}

/** Checks an address and keys without saving anything. */
export async function testConnection(input: ConnectInput): Promise<void> {
  await testStore(normalizeStoreUrl(input.storeUrl), {
    consumerKey: input.consumerKey.trim(),
    consumerSecret: input.consumerSecret.trim(),
  });
}

/** Live check of the saved connection: the keys still work and our webhooks are still active. */
export async function checkSavedConnection(): Promise<{
  webhooksActive: number;
  webhooksTotal: number;
}> {
  const integration = await prisma.wooIntegration.findFirst();
  const credentials =
    integration && integration.status !== 'DISABLED'
      ? openCredentials(integration.credentials)
      : null;
  if (!integration || !credentials) throw new StoreError('UNAUTHORIZED');
  const store = normalizeStoreUrl(integration.baseUrl);
  try {
    await testStore(store, credentials);
    const ids = webhookIdsOf(integration.webhookIds);
    const statuses = await Promise.all(
      ids.map((id) => getWebhookStatus(store, credentials, id).catch(() => 'missing'))
    );
    const active = statuses.filter((status) => status === 'active').length;
    const lastError =
      active === ids.length && ids.length > 0
        ? null
        : 'חלק מההתראות מהחנות כבויות. חברו מחדש כדי להפעיל אותן';
    await prisma.wooIntegration.update({
      where: { id: integration.id },
      data: { status: lastError ? 'ERROR' : 'CONNECTED', lastError },
    });
    return { webhooksActive: active, webhooksTotal: ids.length };
  } catch (error) {
    if (error instanceof StoreError) {
      await prisma.wooIntegration.update({
        where: { id: integration.id },
        data: { status: 'ERROR', lastError: error.message },
      });
    }
    throw error;
  }
}

/** The account recorded as the actor of changes that come from the store. It has no password and cannot sign in. */
async function ensureServiceUser(integrationId: string, existing: string | null): Promise<string> {
  const { tenantId } = await requireTenantContext();
  const email = `woocommerce+${integrationId}@integrations.retzef.invalid`;
  const user = await withIdentityDatabase((db) =>
    db.user.upsert({
      where: { email },
      update: {},
      create: { email, name: 'WooCommerce', password: null, isActive: false, role: 'OPERATIONS' },
      select: { id: true },
    })
  );
  const userId = existing ?? user.id;
  await withIdentityDatabase((db) =>
    db.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: { tenantId, userId, role: 'OPERATIONS' },
      update: { isActive: true },
    })
  );
  return userId;
}

async function removeWebhooks(store: URL, keys: StoreKeys, ids: number[]): Promise<void> {
  await Promise.all(ids.map((id) => deleteWebhook(store, keys, id)));
}

/**
 * Connects the business's store, or reconnects it with new keys. Reconnecting keeps the delivery
 * address and replaces the webhooks we created before, so the store never sends events twice.
 */
export async function connect(input: ConnectInput): Promise<WooConnectionView> {
  await requireTenantContext();
  const store = normalizeStoreUrl(input.storeUrl);
  const keys: StoreKeys = {
    consumerKey: input.consumerKey.trim(),
    consumerSecret: input.consumerSecret.trim(),
  };
  await testStore(store, keys);

  const existing = await prisma.wooIntegration.findFirst();
  if (existing && normalizeStoreUrl(existing.baseUrl).toString() !== store.toString()) {
    const used = await prisma.wooSyncJob.count({ where: { integrationId: existing.id } });
    if (
      used ||
      (await prisma.order.count({ where: { wooIntegrationId: existing.id } })) ||
      (await prisma.product.count({ where: { wooIntegrationId: existing.id } }))
    ) {
      throw new ApiError(
        'STORE_REPLACEMENT_BLOCKED',
        'לא ניתן להחליף חנות לאחר קליטת נתונים; ניתן לחדש מפתחות לאותה חנות',
        409
      );
    }
  }
  const previous = existing ? openCredentials(existing.credentials) : null;
  if (existing && previous) {
    // Best effort: old keys may already be revoked; leftover webhooks are then rejected by signature.
    await removeWebhooks(
      normalizeStoreUrl(existing.baseUrl),
      previous,
      webhookIdsOf(existing.webhookIds)
    ).catch(() => undefined);
  }

  const credentials: WooCredentials = { ...keys, webhookSecret: newWebhookSecret() };
  const pending = {
    baseUrl: store.toString().replace(/\/$/, ''),
    credentials: sealCredentials(credentials),
    enabled: true,
    status: 'ERROR',
    lastError: 'החיבור לא הושלם',
    webhookIds: [],
  };
  const integration = existing
    ? await prisma.wooIntegration.update({ where: { id: existing.id }, data: pending })
    : await prisma.wooIntegration.create({ data: pending });

  const serviceUserId = await ensureServiceUser(integration.id, integration.serviceUserId);
  const created: number[] = [];
  try {
    for (const topic of ORDER_TOPICS) {
      created.push(
        await createWebhook(store, keys, {
          topic,
          deliveryUrl: deliveryUrlFor(integration.id),
          secret: credentials.webhookSecret,
        })
      );
    }
  } catch (error) {
    await removeWebhooks(store, keys, created).catch(() => undefined);
    const message = error instanceof StoreError ? error.message : 'לא ניתן היה ליצור התראות בחנות';
    await prisma.wooIntegration.update({
      where: { id: integration.id },
      data: { serviceUserId, lastError: message },
    });
    throw error;
  }

  await prisma.wooIntegration.update({
    where: { id: integration.id },
    data: { serviceUserId, webhookIds: created, status: 'CONNECTED', lastError: null },
  });
  return getConnection();
}

/** Removes our webhooks from the store and forgets the keys. Received events stay. */
export async function disconnect(): Promise<WooConnectionView> {
  const integration = await prisma.wooIntegration.findFirst();
  if (!integration) return getConnection();
  const credentials = openCredentials(integration.credentials);
  let lastError: string | null = null;
  if (credentials) {
    await removeWebhooks(
      normalizeStoreUrl(integration.baseUrl),
      credentials,
      webhookIdsOf(integration.webhookIds)
    ).catch(() => {
      lastError =
        'לא ניתן היה למחוק את ההתראות בחנות. מחקו אותן ידנית ב-WooCommerce › הגדרות › מתקדם › Webhooks';
    });
  }
  await prisma.wooIntegration.update({
    where: { id: integration.id },
    data: { enabled: false, status: 'DISABLED', credentials: {}, webhookIds: [], lastError },
  });
  return getConnection();
}
