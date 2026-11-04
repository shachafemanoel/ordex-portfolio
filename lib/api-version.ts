/**
 * API Versioning Strategy
 * Supports flexible versioning with backward compatibility
 */

export const API_VERSION = 'v1' as const;

export const API_VERSIONS = {
  V1: 'v1',
} as const;

export type ApiVersion = typeof API_VERSIONS[keyof typeof API_VERSIONS];

/**
 * API Version metadata for responses
 */
export interface ApiVersionInfo {
  version: ApiVersion;
  deprecated?: boolean;
  deprecationDate?: string;
  replacedBy?: ApiVersion;
  supportedUntil?: string;
}

/**
 * Enhanced API response with versioning information
 */
export interface VersionedApiResponse<TData = unknown, TMeta = unknown> {
  success: boolean;
  data?: TData;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    field?: string;
    supportReference?: string;
    retryAfter?: number;
  };
  meta?: TMeta;
  timestamp: string;
  requestId: string;
  version: ApiVersionInfo;
}

/**
 * Get version info for current API version
 */
export function getVersionInfo(version: ApiVersion = API_VERSION): ApiVersionInfo {
  const versionMap: Record<ApiVersion, ApiVersionInfo> = {
    v1: {
      version: 'v1',
      deprecated: false,
    },
  };

  return versionMap[version] || versionMap.v1;
}

/**
 * Create versioned API response
 */
export function createVersionedResponse<T>(
  data: T,
  requestId: string,
  version: ApiVersion = API_VERSION,
  meta?: any
): VersionedApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId,
    version: getVersionInfo(version),
    meta,
  };
}

/**
 * Create versioned error response
 */
export function createVersionedErrorResponse(
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    field?: string;
    supportReference?: string;
    retryAfter?: number;
  },
  requestId: string,
  version: ApiVersion = API_VERSION
): VersionedApiResponse<never> {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
    requestId,
    version: getVersionInfo(version),
  };
}