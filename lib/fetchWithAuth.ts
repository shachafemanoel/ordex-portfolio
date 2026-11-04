/**
 * Authenticated fetch wrapper
 * Automatically attaches JWT token from localStorage to all requests
 */

import { getAuthToken } from '@/lib/auth/tokenStorage';

/**
 * Drop-in replacement for fetch() that automatically includes auth token
 * Usage: Replace `fetch(url, options)` with `fetchWithAuth(url, options)`
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getAuthToken();

  // Merge auth header with existing headers
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log('[fetchWithAuth] ✅ Added Authorization header to request:', {
      url: typeof input === 'string' ? input : input.toString(),
      hasToken: true
    });
  } else if (!token) {
    console.warn('[fetchWithAuth] ⚠️ No token available for request:', {
      url: typeof input === 'string' ? input : input.toString(),
    });
  }

  // Always include credentials for cookie-based auth fallback
  const finalInit: RequestInit = {
    ...init,
    headers,
    credentials: init?.credentials || 'include',
  };

  return fetch(input, finalInit);
}
