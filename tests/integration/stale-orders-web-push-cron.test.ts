import { GET } from '@/app/api/cron/stale-orders-web-push/route';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetchSummary, mockNotify } = vi.hoisted(() => ({
  mockFetchSummary: vi.fn(),
  mockNotify: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getPrismaClient: vi.fn(() => ({})),
}));

vi.mock('@/lib/orders/staleOrderSla', () => ({
  fetchStaleOrdersSlaSummary: (...args: unknown[]) => mockFetchSummary(...args),
}));

vi.mock('@/lib/push/webPush', () => ({
  notifyStaleOrdersDigestWebPush: (...args: unknown[]) => mockNotify(...args),
}));

describe('GET /api/cron/stale-orders-web-push', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SIGNATURE_SECRET = 'cron-test-secret';
  });

  afterEach(() => {
    delete process.env.CRON_SIGNATURE_SECRET;
  });

  it('returns 401 without secret', async () => {
    const req = new NextRequest('http://localhost/api/cron/stale-orders-web-push');
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockFetchSummary).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SIGNATURE_SECRET is unset', async () => {
    delete process.env.CRON_SIGNATURE_SECRET;
    const req = new NextRequest('http://localhost/api/cron/stale-orders-web-push', {
      headers: { authorization: 'Bearer cron-test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns sent:false when no stale orders', async () => {
    mockFetchSummary.mockResolvedValue({ count: 0, oldest: null });

    const req = new NextRequest('http://localhost/api/cron/stale-orders-web-push', {
      headers: { authorization: 'Bearer cron-test-secret' },
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sent).toBe(false);
    expect(json.count).toBe(0);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('calls web push digest when stale orders exist', async () => {
    mockFetchSummary.mockResolvedValue({
      count: 3,
      oldest: { id: 'o1', number: 'ORD-1', createdAt: new Date() },
    });

    const req = new NextRequest('http://localhost/api/cron/stale-orders-web-push', {
      headers: { 'x-cron-secret': 'cron-test-secret' },
    });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sent).toBe(true);
    expect(json.count).toBe(3);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 3,
        oldestOrderNumber: 'ORD-1',
        oldestOrderId: 'o1',
      })
    );
  });
});
