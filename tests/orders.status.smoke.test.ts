import fetch from 'node-fetch';
import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.API_SMOKE_BASE_URL;

const describeIf = BASE_URL ? describe : describe.skip;

async function parseJsonBody(response: Response): Promise<Record<string, unknown>> {
  const parsed: unknown = await response.json().catch(() => ({}));
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }

  return parsed as Record<string, unknown>;
}

describeIf('Orders API error handling smoke', () => {
  it('returns validation_error for malformed order payload', async () => {
    const response = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    const body = await parseJsonBody(response);
    const code = typeof body?.error === 'string' ? body.error : body?.code;
    expect(code).toBe('validation_error');
  });

  it('returns not_found for unknown order on status change', async () => {
    const response = await fetch(`${BASE_URL}/api/orders/00000000-0000-0000-0000-000000000000/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'TO_DO' }),
    });

    expect(response.status).toBe(404);
    const body = await parseJsonBody(response);
    const code = typeof body?.error === 'string' ? body.error : body?.code;
    expect(code).toBe('not_found');
  });
});
