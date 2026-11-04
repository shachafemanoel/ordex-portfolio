import { GoogleOAuthCredentialsService } from '@/lib/services/google-workspace/GoogleOAuthCredentialsService';
import { DEFAULT_WORKSPACE_STORE_ID } from '@/lib/services/google-workspace/InstallationGoogleCalendarService';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'ordex_google_oauth_state';
const ACTOR_COOKIE = 'ordex_google_oauth_actor';

const QuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  error: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const baseRedirect =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}` : '') ||
    '';

  const fail = (msg: string) =>
    NextResponse.redirect(
      `${baseRedirect || 'http://localhost:3000'}/settings/integrations?google=error&message=${encodeURIComponent(msg)}`
    );

  if (req.nextUrl.searchParams.get('error')) {
    return fail(req.nextUrl.searchParams.get('error_description') || 'access_denied');
  }

  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return fail('invalid_callback');
  }

  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== parsed.data.state) {
    return fail('invalid_state');
  }

  const actorId = req.cookies.get(ACTOR_COOKIE)?.value;
  if (!actorId) {
    return fail('missing_actor');
  }

  try {
    const svc = new GoogleOAuthCredentialsService();
    await svc.exchangeCodeAndPersist({
      storeId: DEFAULT_WORKSPACE_STORE_ID,
      code: parsed.data.code,
      connectedByUserId: actorId,
    });

    const res = NextResponse.redirect(
      `${baseRedirect || 'http://localhost:3000'}/settings/integrations?google=connected`
    );
    res.cookies.set(STATE_COOKIE, '', { maxAge: 0, path: '/' });
    res.cookies.set(ACTOR_COOKIE, '', { maxAge: 0, path: '/' });
    return res;
  } catch (e) {
    console.error('[google/callback]', e);
    const res = fail(e instanceof Error ? e.message : 'exchange_failed');
    res.cookies.set(STATE_COOKIE, '', { maxAge: 0, path: '/' });
    res.cookies.set(ACTOR_COOKIE, '', { maxAge: 0, path: '/' });
    return res;
  }
}
