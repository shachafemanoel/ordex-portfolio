import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const runDeepResearchMock = vi.fn();

vi.mock('@/lib/agents/deep-research', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/deep-research')>('@/lib/agents/deep-research');
  return {
    ...actual,
    runDeepResearch: runDeepResearchMock,
  };
});

vi.mock('@/lib/auth/verifySession', () => ({
  verifySessionFromRequest: vi.fn(async () => ({
    user: {
      id: 'tester',
      role: 'ADMIN',
      permissions: [],
      email: 'tester@example.com',
      name: 'Tester',
    },
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  geminiRateLimit: { middleware: vi.fn(async () => null) },
  withRateLimit: (_limiter: any, handler: any) => handler,
}));

describe('POST /api/agents/research', () => {
  beforeEach(() => {
    runDeepResearchMock.mockReset();
  });

  it('returns research result payload', async () => {
    runDeepResearchMock.mockResolvedValue({
      plan_steps: [],
      evidence: [],
      answer: {
        executive_summary: 'ok',
        key_findings: ['one'],
        anomalies_and_bottlenecks: [],
        recommended_actions: [],
        confidence: 0.9,
        limitations: [],
      },
      confidence: 0.9,
      safety_notes: [],
    });

    const { POST } = await import('@/app/api/agents/research/route');

    const req = new NextRequest('http://localhost/api/agents/research', {
      method: 'POST',
      body: JSON.stringify({ query: 'test', locale: 'en' }),
    } as any);

    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.answer.executive_summary).toBe('ok');
    expect(runDeepResearchMock).toHaveBeenCalled();
  });

  it('rejects invalid payloads', async () => {
    const { POST } = await import('@/app/api/agents/research/route');

    const req = new NextRequest('http://localhost/api/agents/research', {
      method: 'POST',
      body: JSON.stringify({ locale: 'en' }),
    } as any);

    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe('validation_error');
    expect(runDeepResearchMock).not.toHaveBeenCalled();
  });
});
