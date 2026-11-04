/**
 * Client-side JWT token storage utilities
 * Provides secure token storage in localStorage with validation
 */

const TOKEN_KEY = 'ordex_auth_token';

/**
 * Store JWT token in localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store auth token:', error);
  }
}

/**
 * Retrieve JWT token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to retrieve auth token:', error);
    return null;
  }
}

/**
 * Remove JWT token from localStorage
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to clear auth token:', error);
  }
}

/**
 * Check if auth token exists
 */
export function hasAuthToken(): boolean {
  return !!getAuthToken();
}
