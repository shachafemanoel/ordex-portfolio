'use client';

import type { UserDTO } from '@/domain/users/normalizeUser';
import { normalizeUser } from '@/domain/users/normalizeUser';
import apiClient, { setLogoutHandler } from '@/lib/apiClient';
import { clearAuthToken } from '@/lib/auth/tokenStorage';
import { Permission, ROLE_PERMISSIONS } from '@/lib/auth/types';
import { isDemo } from '@/lib/featureFlags';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface AuthenticatedClientUser extends UserDTO {
  permissions: Permission[];
}

interface AuthContextValue {
  user: AuthenticatedClientUser | null;
  loading: boolean;
  permissions: Permission[];
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  initialUser?: AuthenticatedClientUser | null;
  children: React.ReactNode;
}

export function AuthProvider({ initialUser, children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthenticatedClientUser | null>(initialUser ?? null);
  const [loading, setLoading] = useState<boolean>(!initialUser);
  const router = useRouter();

  // Prevent concurrent refresh calls
  const refreshingRef = useRef(false);
  // Track mount state to prevent React Strict Mode double execution
  const mountedRef = useRef(false);
  // Track last refresh time for debouncing
  const lastRefreshTimeRef = useRef(0);

  useEffect(() => {
    const reload = (event: StorageEvent) => { if (event.key === 'ordex_auth_token') window.location.reload(); };
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, []);

  const permissions = useMemo(() => user?.permissions ?? [], [user]);

  const hydrateUser = useCallback((payload: any | null) => {
    if (!payload) {
      setUser(null);
      return;
    }

    const normalizedUser = normalizeUser(payload);
    if (!normalizedUser) {
      setUser(null);
      return;
    }

    const roleKey = normalizedUser.role.key;
    const permissionList: Permission[] =
      Array.isArray(payload.permissions) && payload.permissions.length
        ? (payload.permissions as Permission[])
        : ROLE_PERMISSIONS[roleKey];

    setUser({
      ...normalizedUser,
      role: normalizedUser.role,
      permissions: permissionList,
    });
  }, []);

  const refresh = useCallback(async () => {
    // Prevent concurrent refresh calls
    if (refreshingRef.current) {
      console.log('[AuthProvider] Refresh already in progress, skipping');
      return;
    }

    // Debounce - don't refresh if we just refreshed in last 3 seconds
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 3000) {
      console.log('[AuthProvider] Refresh called too soon after previous refresh, skipping');
      return;
    }

    // Try multiple times to get token (handles race condition with login)
    let token = localStorage.getItem('ordex_auth_token');
    let retries = 0;
    while (!token && retries < 3) {
      console.log(`[AuthProvider] Token not found, retry ${retries + 1}/3`);
      await new Promise((resolve) => setTimeout(resolve, 200));
      token = localStorage.getItem('ordex_auth_token');
      retries++;
    }

    // Early return if no token exists - don't make API call
    if (!token && !isDemo()) {
      console.log('[AuthProvider] No token found after retries, skipping session refresh');
      setUser(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      refreshingRef.current = true;
      lastRefreshTimeRef.current = now; // Update last refresh time
      setLoading(true);
      if (token) {
        console.log('[AuthProvider] Refreshing authenticated session');
      } else {
        console.log('[AuthProvider] Refreshing session in Demo Mode (no token)');
      }

      const response = await apiClient('/api/auth/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'include',
        skipAuthRetry: true, // Prevent global logout on 401 during check
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (!response.ok) {
        console.log('[AuthProvider] Session refresh failed with status:', response.status);

        // Only clear token and redirect on 401 (unauthorized)
        if (response.status === 401) {
          console.log('[AuthProvider] Token invalid (401), clearing token');
          clearAuthToken();
          hydrateUser(null);
        } else {
          hydrateUser(null);
        }
        return;
      }

      const payload = await response.json().catch(() => null);
      if (payload?.success) {
        console.log('[AuthProvider] Session refreshed successfully:', payload.data?.email);
        hydrateUser(payload.data);
      } else {
        hydrateUser(null);
      }
    } catch (error) {
      console.error('[AuthProvider] Failed to refresh auth state:', error);
      hydrateUser(null);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
      refreshingRef.current = false;
    }
  }, [hydrateUser]);

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (mountedRef.current) {
      console.log('[AuthProvider] Already mounted, skipping duplicate effect');
      return;
    }

    mountedRef.current = true;
    console.log('[AuthProvider] Initial mount, checking session');

    if (!initialUser) {
      refresh().catch((error) => {
        console.error('[AuthProvider] Auth bootstrap error:', error);
      });
    }

    // Cleanup
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - run only once on mount

  const logout = useCallback(async () => {
    try {
      // Call logout API (skipAuthRetry to avoid recursive 401 handling)
      await apiClient('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        skipAuthRetry: true,
      }).catch(() => undefined);
    } finally {
      // Clear JWT token from localStorage
      clearAuthToken();
      // Clear user state
      hydrateUser(null);
      // Redirect to login page
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        router.push(`/login?returnTo=${encodeURIComponent(currentPath)}`);
      }
    }
  }, [hydrateUser, router]);

  // Register logout handler with apiClient for automatic 401 handling
  useEffect(() => {
    setLogoutHandler(logout);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, permissions, refresh, logout }),
    [user, loading, permissions, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
