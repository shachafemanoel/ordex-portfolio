'use client';

import { setAuthToken } from '@/lib/auth/tokenStorage';

export function enterBusiness(token: string, destination = '/orders') {
  // Unmount in-flight queries and discard drafts/caches before showing another business.
  window.localStorage.clear();
  window.sessionStorage.clear();
  setAuthToken(token);
  window.location.replace(destination);
}
