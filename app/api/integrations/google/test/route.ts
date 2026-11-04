import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { GoogleWorkspaceClient } from '@/lib/services/google-workspace/GoogleWorkspaceClient';
import { DEFAULT_WORKSPACE_STORE_ID } from '@/lib/services/google-workspace/InstallationGoogleCalendarService';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser) => {
    try {
      const client = new GoogleWorkspaceClient();
      const { gmail, calendar } = await client.getGmailAndCalendar(DEFAULT_WORKSPACE_STORE_ID);
      await gmail.users.getProfile({ userId: 'me' });
      await calendar.events.list({ calendarId: 'primary', maxResults: 1 });
      return createSuccessResponse({ ok: true, message: 'Gmail profile and primary calendar reachable' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return createErrorResponse(msg, 502, { code: 'GOOGLE_TEST_FAILED' });
    }
  },
  { roles: ['ADMIN'], permissions: ['MANAGE_INTEGRATIONS'], requireAll: true }
);
