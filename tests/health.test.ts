import { expect, it } from 'vitest';
import { describeIfDatabase } from './helpers/db';
import { GET } from '@/app/api/health/route';

describeIfDatabase('health', () => {
  it('returns ok', async () => {
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(200);
  });
});
