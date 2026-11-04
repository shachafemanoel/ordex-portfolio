import { createApiClient } from '@/lib/api/client';
import { cookies, headers as nextHeaders } from 'next/headers';

// Server-side API client that forwards incoming request cookies/headers
export const serverApi = createApiClient('/api', async () => {
  const cookieHeader = cookies().toString();
  const requestHeaders = await nextHeaders();
  const auth = requestHeaders.get('authorization');
  const corr = requestHeaders.get('x-correlation-id') || crypto.randomUUID();
  const headers: Record<string, string> = {};
  if (cookieHeader) headers.cookie = cookieHeader;
  if (auth) headers.authorization = auth;
  headers['x-correlation-id'] = corr;
  return headers;
});
