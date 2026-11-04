import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import {
  GoogleIntegrationInvalidError,
  GoogleIntegrationMissingError,
} from '@/lib/integrations/google/errors';
import { InstallationGoogleCalendarService } from '@/lib/services/google-workspace/InstallationGoogleCalendarService';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser, context: { params: Promise<{ id: string }> }) => {
    const params = await context.params;
    try {
      const svc = new InstallationGoogleCalendarService();
      await svc.cancelInstallationEvent(params.id);
      return createSuccessResponse({ cancelled: true });
    } catch (e) {
      if (e instanceof GoogleIntegrationMissingError) {
        return createErrorResponse(e.message, 503, { code: e.code });
      }
      if (e instanceof GoogleIntegrationInvalidError) {
        return createErrorResponse(e.message, 409, { code: e.code });
      }
      console.error('[google-calendar/cancel]', e);
      return createErrorResponse(e instanceof Error ? e.message : 'Cancel failed', 502);
    }
  },
  { permissions: ['SCHEDULE_ORDERS'] }
);
