import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type PaginatedResponseEnvelope } from '@/lib/api/client';
import { normalizeOrdersListResponse } from '@/lib/hooks/api/orders/useOrdersQuery';
import { normalizeSuppliers } from '@/lib/hooks/api/suppliers/useSuppliersQuery';
import { normalizeUsers } from '@/lib/hooks/api/users/useUsersQuery';
import { normalizePayments } from '@/lib/hooks/api/payments/usePaymentsQuery';
import type { OrdersListResponse, PaginationMeta } from '@/lib/api/types';

const client = createApiClient('/api');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ModernApiClient canonical parsing', () => {
  it('returns data for canonical single resource envelope', async () => {
    const payload = { data: { id: '123' } };
    vi.spyOn(global, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await client.get<{ id: string }>('/orders/123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(payload.data);
    }
  });

  it('returns envelope for canonical paginated response', async () => {
    const payload: PaginatedResponseEnvelope<{ id: string }> = {
      data: [{ id: '1' }],
      pagination: {
        total: 1,
        page: 1,
        perPage: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };

    vi.spyOn(global, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 })
    );

    const result = await client.get<PaginatedResponseEnvelope<{ id: string }>>('/orders');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(payload);
    }
  });

  it('surfaces invalid shapes as errors', async () => {
    vi.spyOn(global, 'fetch' as any).mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 })
    );

    const result = await client.get<any>('/invalid');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_RESPONSE');
    }
  });
});

describe('Client normalizers', () => {
  it('normalizes canonical orders list envelopes', () => {
    const pagination: PaginationMeta = {
      total: 1,
      page: 1,
      perPage: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    };
    const payload: OrdersListResponse = {
      data: [{ id: 'order-1' } as any],
      pagination,
    };

    const normalized = normalizeOrdersListResponse(payload);

    expect(normalized.items[0]?.id).toBe('order-1');
    expect(normalized.pagination).toEqual(pagination);
  });

  it('normalizes canonical supplier responses', () => {
    const normalized = normalizeSuppliers({
      data: [{ id: 'sup-1', name: 'Test Supplier' }],
      pagination: { total: 1, page: 1, totalPages: 1, limit: 10 },
    });

    expect(normalized.items).toHaveLength(1);
    expect(normalized.items[0]?.name).toBe('Test Supplier');
  });

  it('keeps legacy supplier shape compatibility', () => {
    const normalized = normalizeSuppliers({
      suppliers: [{ id: 'sup-legacy', name: 'Legacy Supplier' }],
    });

    expect(normalized.items[0]?.id).toBe('sup-legacy');
  });

  it('normalizes canonical users responses', () => {
    const normalized = normalizeUsers({
      data: [{ id: 'user-1', name: 'Test User', email: 'a@test.com', role: 'ADMIN' }],
      pagination: { total: 1, page: 1, totalPages: 1, limit: 50 },
    });

    expect(normalized.items[0]?.id).toBe('user-1');
    expect(normalized.pagination?.total).toBe(1);
  });

  it('normalizes canonical payments responses', () => {
    const normalized = normalizePayments({
      data: [{ id: 'pay-1', amountCents: 1000 }],
    });

    expect(normalized.items[0]?.id).toBe('pay-1');
  });
});
