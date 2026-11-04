import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiResponse } from '@/lib/types';

export interface UseApiQueryOptions<T> {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  useCache?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

export interface ApiQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isStale: boolean;
}

// Simple in-memory cache
const queryCache = new Map<string, { data: any; timestamp: number }>();

export function useApiQuery<T>(
  key: string,
  queryFn: () => Promise<ApiResponse<T>>,
  options: UseApiQueryOptions<T> = {}
): ApiQueryResult<T> {
  const {
    enabled = true,
    refetchOnWindowFocus = true,
    refetchInterval,
    staleTime = 5 * 60 * 1000, // 5 minutes default
    useCache = false,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const queryFnRef = useRef(queryFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const fetchData = useCallback(
    async (preferCache = true) => {
      // Check cache first
      if (useCache && preferCache) {
        const cached = queryCache.get(key);
        if (cached && Date.now() - cached.timestamp < staleTime) {
          setData(cached.data);
          setLoading(false);
          onSuccessRef.current?.(cached.data);
          return;
        }
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const response = await queryFnRef.current();

        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        if (response.success && response.data) {
          setData(response.data);
          if (useCache) {
            // Cache the result when enabled
            queryCache.set(key, {
              data: response.data,
              timestamp: Date.now(),
            });
          }
          onSuccessRef.current?.(response.data);
        } else {
          const errorMessage = response.error?.message || 'שגיאה בטעינת הנתונים';
          setError(errorMessage);
          onErrorRef.current?.(errorMessage);
        }
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) {
          return; // Request was cancelled
        }

        const errorMessage = err instanceof Error ? err.message : 'שגיאת רשת';
        setError(errorMessage);
        onErrorRef.current?.(errorMessage);
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [key, staleTime, useCache]
  );

  const refetch = useCallback(() => fetchData(false), [fetchData]);

  // Check if data is stale
  const isStale = useCallback(() => {
    if (!useCache) {
      return true;
    }
    const cached = queryCache.get(key);
    return !cached || Date.now() - cached.timestamp > staleTime;
  }, [key, staleTime, useCache]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, fetchData]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      if (isStale()) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, enabled, fetchData, isStale]);

  // Polling interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    intervalRef.current = setInterval(() => {
      fetchData();
    }, refetchInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refetchInterval, enabled, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    isStale: isStale(),
  };
}

// Utility hook for mutations
export function useApiMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (
      variables: TVariables,
      options?: {
        onSuccess?: (data: TData) => void;
        onError?: (error: string) => void;
      }
    ) => {
      setLoading(true);
      setError(null);

      try {
        const response = await mutationFn(variables);

        if (response.success && response.data) {
          options?.onSuccess?.(response.data);
          return response.data;
        } else {
          const errorMessage = response.error?.message || 'שגיאה בביצוע הפעולה';
          setError(errorMessage);
          options?.onError?.(errorMessage);
          throw new Error(errorMessage);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'שגיאה לא צפויה';
        setError(errorMessage);
        options?.onError?.(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn]
  );

  return {
    mutate,
    loading,
    error,
  };
}
