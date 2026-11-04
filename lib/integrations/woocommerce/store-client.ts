import http from 'node:http';
import https from 'node:https';
import { guardedLookup, isAllowedLiteralHost, StoreAddressError } from './store-address';

export interface StoreKeys {
  consumerKey: string;
  consumerSecret: string;
}

export type StoreErrorCode =
  | 'INVALID_ADDRESS'
  | 'UNREACHABLE'
  | 'NOT_WOOCOMMERCE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_RESPONSE';

const MESSAGES: Record<StoreErrorCode, string> = {
  INVALID_ADDRESS: 'כתובת החנות חייבת להתחיל ב-https:// ולהוביל לאתר ציבורי',
  UNREACHABLE: 'החנות לא זמינה. בדקו את הכתובת ונסו שוב',
  NOT_WOOCOMMERCE:
    'בכתובת הזו לא נמצא WooCommerce. בדקו את הכתובת, ושב-WordPress הקישורים הקבועים אינם מוגדרים כ"רגיל"',
  UNAUTHORIZED: 'המפתחות שגויים או שבוטלו בחנות',
  FORBIDDEN: 'למפתח אין הרשאה מספקת. צרו בחנות מפתח עם הרשאת Read/Write',
  BAD_RESPONSE: 'החנות החזירה תשובה לא צפויה',
};

export class StoreError extends Error {
  constructor(readonly code: StoreErrorCode) {
    super(MESSAGES[code]);
    this.name = 'StoreError';
  }
}

const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/**
 * One call to the store's REST API (`/wp-json/wc/v3/...`). Redirects are not followed, because a
 * redirect could lead anywhere; the response size and the time are capped.
 */
export function storeRequest<T>(
  store: URL,
  keys: StoreKeys,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  // A store at the root has the pathname "/"; keep a single slash so the URL never turns protocol-relative.
  const url = new URL(
    `${store.pathname.replace(/\/+$/, '')}/wp-json/wc/v3/${path.replace(/^\//, '')}`,
    store.origin
  );
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  const transport = url.protocol === 'https:' ? https : http;
  if (!isAllowedLiteralHost(url)) return Promise.reject(new StoreError('INVALID_ADDRESS'));

  return new Promise<T>((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method,
        lookup: guardedLookup as never,
        timeout: TIMEOUT_MS,
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${keys.consumerKey}:${keys.consumerSecret}`).toString('base64')}`,
          'User-Agent': 'Retzef/1.0 (+order-intake)',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) }
            : {}),
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            request.destroy();
            reject(new StoreError('BAD_RESPONSE'));
          } else {
            chunks.push(chunk);
          }
        });
        response.on('end', () => {
          if (status === 401) return reject(new StoreError('UNAUTHORIZED'));
          if (status === 403) return reject(new StoreError('FORBIDDEN'));
          if (status === 404 || (status >= 300 && status < 400))
            return reject(new StoreError('NOT_WOOCOMMERCE'));
          if (status < 200 || status >= 300)
            return reject(new StoreError(status >= 500 ? 'UNREACHABLE' : 'BAD_RESPONSE'));
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T);
          } catch {
            reject(new StoreError('NOT_WOOCOMMERCE'));
          }
        });
      }
    );
    // A socket timeout alone does not bound DNS resolution or an unfinished response.
    const deadline = setTimeout(() => request.destroy(new StoreError('UNREACHABLE')), TIMEOUT_MS);
    deadline.unref?.();
    request.once('close', () => clearTimeout(deadline));
    request.on('timeout', () => request.destroy(new StoreError('UNREACHABLE')));
    request.on('error', (error) => {
      if (error instanceof StoreError) return reject(error);
      reject(
        new StoreError(error instanceof StoreAddressError ? 'INVALID_ADDRESS' : 'UNREACHABLE')
      );
    });
    if (payload) request.write(payload);
    request.end();
  });
}

export const ORDER_TOPICS = ['order.created', 'order.updated'] as const;

/** Reading orders proves the address, the keys and read permission without changing anything. */
export async function testStore(store: URL, keys: StoreKeys): Promise<void> {
  const orders = await storeRequest<unknown>(store, keys, 'GET', 'orders?per_page=1');
  if (!Array.isArray(orders)) throw new StoreError('NOT_WOOCOMMERCE');
}

export async function createWebhook(
  store: URL,
  keys: StoreKeys,
  input: { topic: string; deliveryUrl: string; secret: string }
): Promise<number> {
  const created = await storeRequest<{ id?: unknown }>(store, keys, 'POST', 'webhooks', {
    name: `Retzef · ${input.topic}`,
    topic: input.topic,
    delivery_url: input.deliveryUrl,
    secret: input.secret,
    status: 'active',
  });
  if (typeof created.id !== 'number') throw new StoreError('BAD_RESPONSE');
  return created.id;
}

/** Removing a webhook that is already gone counts as success. */
export async function deleteWebhook(store: URL, keys: StoreKeys, id: number): Promise<void> {
  try {
    await storeRequest(store, keys, 'DELETE', `webhooks/${id}?force=true`);
  } catch (error) {
    if (!(error instanceof StoreError && error.code === 'NOT_WOOCOMMERCE')) throw error;
  }
}

export async function getWebhookStatus(store: URL, keys: StoreKeys, id: number): Promise<string> {
  const webhook = await storeRequest<{ status?: unknown }>(store, keys, 'GET', `webhooks/${id}`);
  return typeof webhook.status === 'string' ? webhook.status : 'unknown';
}
