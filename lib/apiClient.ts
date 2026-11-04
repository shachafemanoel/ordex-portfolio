'use client';

import { clearAuthToken, getAuthToken } from '@/lib/auth/tokenStorage';
import type { ApiError, ApiResponse } from '@/lib/types';

interface ApiClientOptions extends RequestInit {
  // We can add custom options here in the future
  skipAuthRetry?: boolean; // Skip auto-logout on 401 (for logout endpoint itself)
}

// Track if we're already handling a logout to prevent race conditions
let isLoggingOut = false;

// Logout handler that can be set by AuthProvider
let logoutHandler: (() => Promise<void>) | null = null;

export function setLogoutHandler(handler: () => Promise<void>) {
  logoutHandler = handler;
}

async function handleUnauthorized(endpoint: string): Promise<void> {
  // Prevent multiple simultaneous logouts
  if (isLoggingOut) {
    return;
  }

  isLoggingOut = true;

  try {
    console.warn(`Unauthorized response from ${endpoint}. Logging out...`);

    // Clear auth token from localStorage
    clearAuthToken();

    // If a logout handler is registered (from AuthProvider), use it
    if (logoutHandler) {
      await logoutHandler();
    } else {
      // Fallback: redirect to login page
      const currentPath = window.location.pathname;
      const loginUrl = `/login?returnTo=${encodeURIComponent(currentPath)}`;
      window.location.href = loginUrl;
    }
  } finally {
    // Reset flag after a delay to allow the redirect/logout to complete
    setTimeout(() => {
      isLoggingOut = false;
    }, 1000);
  }
}

type BaseRequest = (endpoint: string, options?: ApiClientOptions) => Promise<Response>;

type ApiClientWithHelpers = BaseRequest & {
  get<T>(endpoint: string, options?: ApiClientOptions): Promise<ApiResponse<T>>;
  post<T>(endpoint: string, body?: unknown, options?: ApiClientOptions): Promise<ApiResponse<T>>;
  patch<T>(endpoint: string, body?: unknown, options?: ApiClientOptions): Promise<ApiResponse<T>>;
  delete<T>(endpoint: string, options?: ApiClientOptions): Promise<ApiResponse<T>>;
};

async function baseRequest(endpoint: string, options: ApiClientOptions = {}): Promise<Response> {
  const { skipAuthRetry, ...fetchOptions } = options;
  const token = getAuthToken();
  const headers = new Headers(fetchOptions.headers || {});

  console.log('[apiClient] Making request:', {
    endpoint,
    hasToken: !!token,
    tokenLength: token?.length,
    method: fetchOptions.method || 'GET',
  });

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...fetchOptions,
    headers,
    credentials: 'include', // Always include cookies for hybrid auth
  });

  console.log('[apiClient] Response received:', {
    endpoint,
    status: response.status,
    ok: response.ok,
  });

  // Handle 401 Unauthorized - but be less aggressive
  if (response.status === 401 && !skipAuthRetry) {
    // Only logout if this is an auth endpoint itself failing
    // For other endpoints, the user might still be authenticated via cookies
    const isAuthEndpoint = endpoint.includes('/api/auth/');

    if (isAuthEndpoint) {
      console.warn('[apiClient] Auth endpoint failed with 401, logging out');
      await handleUnauthorized(endpoint);
    } else {
      // For non-auth endpoints, just log the error but don't force logout
      // The session cookie might still be valid
      console.warn(
        '[apiClient] API endpoint returned 401, but keeping session (cookie auth may still work)'
      );
    }
  }

  return response;
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildErrorResponse(response: Response, payload: any): ApiResponse<never> {
  const apiError: ApiError = {
    message:
      payload?.error?.message ||
      payload?.detail?.message ||
      payload?.message ||
      (typeof payload?.error === 'string' ? payload.error : null) ||
      response.statusText ||
      'Request failed',
    code: payload?.error?.code || payload?.code,
    status: response.status,
    details: payload?.error?.details,
  };

  return {
    success: false,
    error: apiError,
    raw: payload,
  };
}

function buildSuccessResponse<T>(payload: any): ApiResponse<T> {
  const data =
    payload && typeof payload === 'object' && 'data' in payload ? (payload as any).data : payload;
  const meta =
    payload && typeof payload === 'object'
      ? ((payload as any).meta ?? (payload as any).pagination)
      : undefined;

  return {
    success: true,
    data: data as T,
    meta: meta as any,
    raw: payload,
  };
}

async function requestJson<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const { skipAuthRetry, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});

  const hasBody = body !== undefined;
  const finalBody =
    body instanceof FormData ? body : hasBody ? JSON.stringify(body) : fetchOptions.body;

  if (hasBody && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await baseRequest(endpoint, {
    ...fetchOptions,
    method,
    headers,
    body: finalBody,
    skipAuthRetry,
  });

  const payload = await parseJson(response);

  if (!response.ok || payload?.success === false) {
    return buildErrorResponse(response, payload);
  }

  return buildSuccessResponse<T>(payload);
}

const apiClient = baseRequest as ApiClientWithHelpers;

apiClient.get = <T>(endpoint: string, options?: ApiClientOptions) =>
  requestJson<T>('GET', endpoint, undefined, options);

apiClient.post = <T>(endpoint: string, body?: unknown, options?: ApiClientOptions) =>
  requestJson<T>('POST', endpoint, body, options);

apiClient.patch = <T>(endpoint: string, body?: unknown, options?: ApiClientOptions) =>
  requestJson<T>('PATCH', endpoint, body, options);

apiClient.delete = <T>(endpoint: string, options?: ApiClientOptions) =>
  requestJson<T>('DELETE', endpoint, undefined, options);

export { apiClient };
export default apiClient;
