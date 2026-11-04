import type { WooCustomer, WooOrder, WooProduct } from '@/lib/woocommerce/types';

function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.includes('/wp-json/')
    ? trimmed
    : `${trimmed}/wp-json/wc/v3`;
}

function getCredentials() {
  if (process.env.TENANT_ENFORCEMENT === 'true') return null;
  const baseUrl =
    process.env.WOOCOMMERCE_URL ??
    process.env.WOO_URL ??
    process.env.NEXT_PUBLIC_WOOCOMMERCE_URL;
  const consumerKey =
    process.env.WOOCOMMERCE_CONSUMER_KEY ?? process.env.WOO_CONSUMER_KEY ?? null;
  const consumerSecret =
    process.env.WOOCOMMERCE_CONSUMER_SECRET ?? process.env.WOO_CONSUMER_SECRET ?? null;

  if (!baseUrl || !consumerKey || !consumerSecret) {
    return null;
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    consumerKey,
    consumerSecret,
  };
}

class WooCommerceClient {
  constructor(
    private baseUrl: string,
    private consumerKey: string,
    private consumerSecret: string
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set(
      'Authorization',
      `Basic ${Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64')}`
    );

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`WooCommerce request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async getCustomers(params: Record<string, string | number | undefined> = {}) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    }

    const suffix = searchParams.toString() ? `?${searchParams}` : '';
    const data = await this.request<WooCustomer[]>(`/customers${suffix}`);
    return { data };
  }

  async createCustomer(payload: Record<string, unknown>) {
    return this.request<WooCustomer>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getOrder(orderId: number) {
    return this.request<WooOrder>(`/orders/${orderId}`);
  }

  async getProduct(productId: number) {
    return this.request<WooProduct>(`/products/${productId}`);
  }

  async updateOrderStatus(orderId: number, status: string) {
    return this.request<WooOrder>(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }
}

export function getWooCommerceClient(): WooCommerceClient | null {
  const credentials = getCredentials();
  if (!credentials) {
    return null;
  }

  return new WooCommerceClient(
    credentials.baseUrl,
    credentials.consumerKey,
    credentials.consumerSecret
  );
}

export type { WooCustomer, WooOrder, WooProduct } from '@/lib/woocommerce/types';
