import { createHmac } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface MockWebhook {
  id: number;
  topic: string;
  delivery_url: string;
  secret: string;
  status: string;
}

/**
 * A minimal WooCommerce REST API for tests: orders (read), webhooks (create, read, delete), and a
 * way to deliver a signed event the way a real store does.
 */
export async function startMockStore(
  keys = { consumerKey: 'ck_' + 'a'.repeat(40), consumerSecret: 'cs_' + 'b'.repeat(40) }
) {
  const orders = new Map<number, Record<string, unknown>>();
  const products = new Map<number, Record<string, unknown>>();
  let revoked = false;
  const webhooks = new Map<number, MockWebhook>();
  let nextId = 100;
  const expectedAuth = `Basic ${Buffer.from(`${keys.consumerKey}:${keys.consumerSecret}`).toString('base64')}`;

  const server = http.createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url ?? '/', 'http://store.test');
    if (!url.pathname.startsWith('/wp-json/wc/v3/')) return send(404, { code: 'rest_no_route' });
    if (revoked || req.headers.authorization !== expectedAuth)
      return send(401, { code: 'woocommerce_rest_cannot_view' });

    const route = url.pathname.slice('/wp-json/wc/v3/'.length);
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
      if (req.method === 'GET' && (route === 'orders' || route === 'products')) {
        const source = route === 'orders' ? orders : products;
        const selected = [...source.values()].filter(
          (o) =>
            !url.searchParams.get('status') ||
            url.searchParams.get('status')!.split(',').includes(String(o.status))
        );
        const perPage = Number(url.searchParams.get('per_page') || 20);
        const page = Number(url.searchParams.get('page') || 1);
        return send(200, selected.slice((page - 1) * perPage, page * perPage));
      }
      const orderId = /^orders\/(\d+)$/.exec(route);
      if (orderId && req.method === 'GET')
        return send(
          orders.has(Number(orderId[1])) ? 200 : 404,
          orders.get(Number(orderId[1])) ?? {}
        );
      if (route === 'webhooks' && req.method === 'POST') {
        const webhook: MockWebhook = {
          id: nextId++,
          topic: body.topic,
          delivery_url: body.delivery_url,
          secret: body.secret,
          status: body.status ?? 'active',
        };
        webhooks.set(webhook.id, webhook);
        return send(201, { ...webhook, secret: undefined });
      }
      const match = /^webhooks\/(\d+)$/.exec(route);
      const webhook = match ? webhooks.get(Number(match[1])) : undefined;
      if (match && !webhook) return send(404, { code: 'woocommerce_rest_webhook_invalid_id' });
      if (webhook && req.method === 'GET') return send(200, { ...webhook, secret: undefined });
      if (webhook && req.method === 'DELETE') {
        webhooks.delete(webhook.id);
        return send(200, { ...webhook, secret: undefined });
      }
      return send(404, { code: 'rest_no_route' });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  /** Posts an order event to every webhook for the topic, signed with that webhook's secret. */
  async function deliver(
    topic: string,
    order: Record<string, unknown>,
    options: { secret?: string } = {}
  ) {
    orders.set(Number(order.id), order);
    const results: number[] = [];
    for (const webhook of webhooks.values()) {
      if (webhook.topic !== topic) continue;
      const body = JSON.stringify(order);
      const signature = createHmac('sha256', options.secret ?? webhook.secret)
        .update(body)
        .digest('base64');
      const response = await fetch(webhook.delivery_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WC-Webhook-Topic': topic,
          'X-WC-Webhook-Resource': 'order',
          'X-WC-Webhook-Event': topic.split('.')[1],
          'X-WC-Webhook-Signature': signature,
          'X-WC-Webhook-ID': String(webhook.id),
          'X-WC-Webhook-Delivery-ID': String(Date.now()),
        },
        body,
      });
      results.push(response.status);
    }
    return results;
  }

  return {
    url: `http://127.0.0.1:${port}`,
    keys,
    orders,
    products,
    revoke: () => {
      revoked = true;
    },
    webhooks,
    deliver,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export function wooOrder(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    number: String(id),
    status: 'processing',
    date_created_gmt: '2026-10-29T08:00:00',
    date_modified_gmt: '2026-10-29T08:00:00',
    customer_id: 0,
    currency: 'ILS',
    date_paid_gmt: null,
    total_tax: '0.00',
    shipping_total: '0.00',
    discount_total: '0.00',
    shipping: {
      first_name: 'דנה',
      last_name: 'כהן',
      address_1: 'הרצל 5',
      address_2: '',
      city: 'חיפה',
      country: 'IL',
      postcode: '',
    },
    total: '450.00',
    billing: {
      address_1: 'הרצל 5',
      city: 'חיפה',
      first_name: 'דנה',
      last_name: 'כהן',
      phone: '0521234567',
      email: 'dana@example.invalid',
    },
    line_items: [
      {
        id: 1,
        product_id: 10,
        variation_id: 0,
        name: 'ספה',
        sku: 'SOFA-3',
        quantity: 1,
        subtotal: '450.00',
        total: '450.00',
        total_tax: '0.00',
      },
    ],
    ...overrides,
  };
}
