'use server';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/config';

export async function clearExpiredSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
