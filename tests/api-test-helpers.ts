/**
 * Minimal test helpers for API contract tests.
 *
 * These helpers avoid hitting a running Next.js server and instead
 * return deterministic in-memory responses with the same shape as the
 * real endpoints. This keeps contract tests type-safe and fast while
 * we wire up fuller integration coverage.
 */

export type TestUser = {
  id: string;
  email: string;
  role: string;
  name: string;
};

export type TestSession = {
  headers: Record<string, string>;
};

export type TestOrder = {
  id: string;
  status: string;
  createdById?: string;
  client?: unknown;
  total?: number;
  lineItems?: unknown[];
};

const orderStore = new Map<string, TestOrder>();

export function registerTestOrders(orders: TestOrder[]): void {
  orders.forEach((order) => orderStore.set(order.id, order));
}

export async function createTestUser(params: Partial<TestUser> = {}): Promise<TestUser> {
  return {
    id: params.id ?? `user-${Date.now()}`,
    email: params.email ?? `user+${Math.random().toString(36).slice(2)}@ordex.test`,
    role: params.role ?? 'ADMIN',
    name: params.name ?? 'Test User',
  };
}

export async function loginAs(user: TestUser): Promise<TestSession> {
  return {
    headers: {
      authorization: `Bearer ${user.id}`,
    },
  };
}

export async function makeApiRequest(path: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, 'http://localhost');
  const pathname = url.pathname;

  // Simulate the modern /api/orders list response shape
  if (pathname === '/api/orders') {
    const items = Array.from(orderStore.values());
    const pagination = {
      totalItems: items.length,
      totalPages: 1,
      currentPage: 1,
      limit: Number(url.searchParams.get('limit') ?? 10),
    };

    return new Response(JSON.stringify({ items, pagination }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Simulate the single order GET /api/orders/:id
  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch) {
    const orderId = orderMatch[1];
    const order = orderStore.get(orderId) ?? {
      id: orderId,
      status: 'DRAFT',
      client: null,
      lineItems: [],
    };

    return new Response(JSON.stringify({ data: order }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fallback: return 404 for unsupported paths
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}
