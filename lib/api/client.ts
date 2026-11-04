/**
 * Modern API Client
 *
 * Updated to work with Phase 1 & Phase 2 backend architecture:
 * - Standardized response envelopes: { data: T } or { data: T[], pagination: {...} }
 * - Correlation ID tracking
 * - Type-safe error handling
 *
 * @module lib/api/client
 */

import { parseErrorPayload } from '@/lib/ui/apiErrors';

/**
 * API Response envelope (Phase 1 standard)
 */
export interface ApiResponseEnvelope<T> {
  data: T;
}

/**
 * Paginated API response envelope
 */
export interface PaginatedResponseEnvelope<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

/**
 * API Error response
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
  };
  correlationId?: string;
}

/**
 * Success result
 */
export interface SuccessResult<T> {
  success: true;
  data: T;
  correlationId?: string;
}

/**
 * Error result
 */
export interface ErrorResult {
  success: false;
  error: {
    message: string;
    code?: string;
    status?: number;
    details?: any;
    field?: string;
  };
  correlationId?: string;
}

/**
 * API Result (success or error)
 */
export type ApiResult<T> = SuccessResult<T> | ErrorResult;

/**
 * Request options
 */
export interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

/**
 * Modern API Client
 */
export class ModernApiClient {
  private unauthorizedHandler?: (endpoint: string, status: number) => Promise<void>;

  constructor(
    private baseUrl: string = '/api',
    private extraHeaders?: () => Promise<HeadersInit> | HeadersInit
  ) {}

  /**
   * Register handler for 401 Unauthorized responses
   */
  setUnauthorizedHandler(handler: (endpoint: string, status: number) => Promise<void>) {
    this.unauthorizedHandler = handler;
  }

  /**
   * Make HTTP request
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResult<T>> {
    try {
      // Build URL with query params
      const url = this.buildUrl(endpoint, options.params);

      // Build headers
      const headers = await this.buildHeaders(options.headers);

      // Make request
      const startTime = Date.now();
      const correlationId = this.generateCorrelationId();

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          'x-correlation-id': correlationId,
        },
        credentials: options.credentials || 'include',
      });

      const duration = Date.now() - startTime;

      // Extract correlation ID from response
      const responseCorrelationId =
        response.headers.get('x-correlation-id') || correlationId;

      // Log request (debug mode)
      if (this.isDebugMode()) {
        console.debug('[API]', {
          method: options.method || 'GET',
          endpoint,
          status: response.status,
          duration,
          correlationId: responseCorrelationId,
        });
      }

      // Parse response body
      let body: any = null;
      try {
        const text = await response.text();
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }

      // Handle errors
      if (!response.ok) {
        const parsedError = parseErrorPayload(body, response.status);

        // Call unauthorized handler for 401 responses
        if (response.status === 401 && this.unauthorizedHandler) {
          await this.unauthorizedHandler(endpoint, response.status);
        }

        return {
          success: false,
          error: {
            message: parsedError.message || 'Request failed',
            code: parsedError.code || 'API_ERROR',
            status: response.status,
            details: parsedError.detail || body,
          },
          correlationId: responseCorrelationId,
        };
      }

      // Handle success - extract data from canonical envelope
      let data: T;
      try {
        data = this.extractData<T>(body, endpoint);
      } catch (shapeError) {
        return {
          success: false,
          error: {
            message:
              shapeError instanceof Error ? shapeError.message : 'Invalid response shape',
            code: 'INVALID_RESPONSE',
            status: response.status,
            details: body,
          },
          correlationId: responseCorrelationId,
        };
      }

      return {
        success: true,
        data,
        correlationId: responseCorrelationId,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          code: 'NETWORK_ERROR',
        },
      };
    }
  }

  /**
   * Extract data from response envelope
   *
   * Expects the canonical format ({ data: T } or { data: T[], pagination })
   * Allows a minimal legacy compatibility path for raw arrays while we finish the migration.
   */
  private extractData<T>(body: any, endpoint: string): T {
    if (body === null || body === undefined) {
      // Some endpoints legitimately return empty responses (e.g., deletes)
      return body as T;
    }

    if (body && typeof body === 'object' && 'data' in body) {
      if ('pagination' in body && Array.isArray((body as any).data)) {
        return body as T;
      }
      return (body as any).data as T;
    }

    if (Array.isArray(body)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[API Client] Non-canonical array response detected from ${endpoint}; wrap in { data }`
        );
      }
      return body as T;
    }

    throw new Error(
      `[API Client] Expected response with a data field from ${endpoint}, received ${typeof body}`
    );
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const baseUrl = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  /**
   * Build request headers
   */
  private async buildHeaders(customHeaders?: HeadersInit): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add extra headers from provider
    if (this.extraHeaders) {
      try {
        const extra = await this.extraHeaders();
        Object.assign(headers, extra);
      } catch (error) {
        console.warn('[API Client] Failed to get extra headers:', error);
      }
    }

    // Merge with custom headers
    if (customHeaders) {
      Object.assign(headers, customHeaders);
    }

    return headers;
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Check if debug mode is enabled
   */
  private isDebugMode(): boolean {
    return (
      (typeof process !== 'undefined' &&
        process.env?.NEXT_PUBLIC_API_DEBUG === 'true') ||
      (typeof window !== 'undefined' && (window as any).__ORD_API_DEBUG__)
    );
  }

  // HTTP Methods

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

/**
 * Create API client instance
 */
export function createApiClient(
  baseUrl?: string,
  extraHeaders?: () => Promise<HeadersInit> | HeadersInit
): ModernApiClient {
  return new ModernApiClient(baseUrl, extraHeaders);
}

/**
 * Default API client instance
 */
export const apiClient = createApiClient();
