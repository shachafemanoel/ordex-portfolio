/**
 * Builds a complete API URL for server-side fetch calls
 * @param endpoint - API endpoint without /api prefix (e.g., 'reports/dashboard')
 */
export function buildApiUrl(endpoint: string): string {
  // Ensure endpoint doesn't start with slash or 'api/'
  const cleanEndpoint = endpoint.replace(/^(\/|api\/)*/, '');

  // Get base URL for the API - never default to localhost in production
  let apiBase: string;
  
  if (process.env.NEXT_PUBLIC_API_BASE?.startsWith('http')) {
    apiBase = process.env.NEXT_PUBLIC_API_BASE;
  } else if (process.env.NODE_ENV === 'production') {
    // In production, use relative URLs to avoid localhost issues
    apiBase = '/api';
  } else {
    // Development only: use localhost
    apiBase = `http://localhost:${process.env.PORT || 3000}/api`;
  }

  return `${apiBase}/${cleanEndpoint}`;
}

/**
 * Server-side fetch wrapper with proper error handling
 * @param endpoint - API endpoint without /api prefix (e.g., 'reports/dashboard')
 * @param options - Fetch options
 */
export async function serverFetch(endpoint: string, options?: RequestInit) {
  const url = buildApiUrl(endpoint);

  try {
    const debug = process.env.DEBUG_SERVER_FETCH === '1' || process.env.NEXT_PUBLIC_DEBUG === '1';
    const start = Date.now();
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
    if (debug) {
       
      console.log(`[serverFetch] ${response.status} ${url} in ${Date.now() - start}ms`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API Error ${response.status}: ${response.statusText}. ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  } catch (error) {
    console.error(`Server fetch error for endpoint '${endpoint}' (${url}):`, error);
    throw error;
  }
}
