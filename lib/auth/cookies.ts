import type { NextRequest, NextResponse } from 'next/server';

import { authConfig, SESSION_COOKIE_NAME } from '@/lib/auth/config';

type RequestCookieStore = {
  get: (name: string) => { name: string; value: string } | undefined;
};

export const FALLBACK_BLOCK_COOKIE = 'ordex.nofallback';

function isLocalhostCookieHost(): boolean {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

  try {
    const { hostname } = new URL(candidate);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function shouldUseSecureCookies(): boolean {
  return process.env.NODE_ENV === 'production' && !isLocalhostCookieHost();
}

export function getSessionCookie(req: NextRequest): string | null {
  const cookieStore = (req as unknown as { cookies?: RequestCookieStore }).cookies;
  if (!cookieStore?.get) {
    return null;
  }

  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

const isSecureContext = shouldUseSecureCookies();

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    secure: isSecureContext,
  });
}

export function setFallbackBlockCookie(response: NextResponse, maxAgeSeconds = 60 * 60 * 24 * 30) {
  response.cookies.set({
    name: FALLBACK_BLOCK_COOKIE,
    value: '1',
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: maxAgeSeconds,
    secure: isSecureContext,
  });
}

export function clearFallbackBlockCookie(response: NextResponse) {
  response.cookies.set({
    name: FALLBACK_BLOCK_COOKIE,
    value: '',
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 0,
    secure: isSecureContext,
  });
}

export function setSessionCookie(response: NextResponse, token: string, remember = false): void {
  const maxAge = remember ? authConfig.rememberMaxAge : authConfig.sessionMaxAge;
  const cookieOptions = {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: shouldUseSecureCookies(),
    path: '/',
    maxAge,
  };

  response.cookies.set(cookieOptions);
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  return getSessionCookie(req);
}
