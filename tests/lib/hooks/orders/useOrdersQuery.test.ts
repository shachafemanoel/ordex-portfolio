import { describe, expect, it } from 'vitest';
import { normalizeOrdersListResponse } from '@/lib/hooks/api/orders/useOrdersQuery';

const sampleOrder = { id: 'order-1', number: 'ORD-TEST-0001' } as any;

describe('normalizeOrdersListResponse', () => {
  it('handles canonical paginated envelopes', () => {
    const result = normalizeOrdersListResponse({
      data: [sampleOrder],
      pagination: { total: 1, page: 1, perPage: 10, totalPages: 1 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('order-1');
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.page).toBe(1);
  });

  it('falls back to legacy items arrays', () => {
    const result = normalizeOrdersListResponse({
      items: [sampleOrder],
      pagination: { total: 1, page: 1, perPage: 10, totalPages: 1 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('coerces object maps into arrays', () => {
    const result = normalizeOrdersListResponse({
      data: { a: sampleOrder },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].number).toBe('ORD-TEST-0001');
    expect(result.pagination.total).toBe(1);
  });
});
