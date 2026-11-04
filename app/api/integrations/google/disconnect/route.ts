import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { GoogleOAuthCredentialsService } from '@/lib/services/google-workspace/GoogleOAuthCredentialsService';
import { DEFAULT_WORKSPACE_STORE_ID } from '@/lib/services/google-workspace/InstallationGoogleCalendarService';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser) => {
    try {
      const svc = new GoogleOAuthCredentialsService();
      await svc.disconnect(DEFAULT_WORKSPACE_STORE_ID);
      return createSuccessResponse({ disconnected: true });
    } catch (e) {
      console.error('[google/disconnect]', e);
      return createErrorResponse('Failed to disconnect Google', 500);
    }
  },
  { roles: ['ADMIN'], permissions: ['MANAGE_INTEGRATIONS'], requireAll: true }
);
