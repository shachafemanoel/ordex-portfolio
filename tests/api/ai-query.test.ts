import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const queryMock = vi.fn();

vi.mock('@/lib/ai/analytics-agent', () => ({
  analyticsAgent: {
    query: queryMock,
  },
}));

vi.mock('@/lib/auth/verifySession', () => ({
  verifySessionFromRequest: vi.fn(async () => ({
    user: {
      id: 'tester',
      role: 'ADMIN',
      email: 'tester@example.com',
      name: 'Tester',
    },
  })),
}));

beforeEach(() => {
  queryMock.mockReset();
});

describe('POST /api/ai/query', () => {
  it('returns AI result payload from analytics agent', async () => {
    queryMock.mockResolvedValue({
      timestamp: new Date('2024-01-01T00:00:00Z'),
      result: 'Store looks healthy',
      toolCalls: [],
      usage: { totalTokens: 10, promptTokens: 5, completionTokens: 5 },
    });

    const { POST } = await import('@/app/api/ai/query/route');

    const req = new NextRequest('http://localhost/api/ai/query', {
      method: 'POST',
      body: JSON.stringify({ query: 'how is the store?', options: { maxTurns: 1 } }),
    } as any);

    const res = await POST(req as any, { id: 'tester', role: 'ADMIN' } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.result).toBe('Store looks healthy');
    expect(queryMock).toHaveBeenCalledWith('how is the store?', { maxTurns: 1 });
  });
});
