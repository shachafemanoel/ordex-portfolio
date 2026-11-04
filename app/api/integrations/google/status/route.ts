import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { GoogleIntegrationStatusService } from '@/lib/services/google-workspace/GoogleIntegrationStatusService';
import { DEFAULT_WORKSPACE_STORE_ID } from '@/lib/services/google-workspace/InstallationGoogleCalendarService';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser) => {
    try {
      const svc = new GoogleIntegrationStatusService();
      const data = await svc.getPublicStatus(DEFAULT_WORKSPACE_STORE_ID);
      return createSuccessResponse(data);
    } catch (e) {
      console.error('[google/status]', e);
      return createErrorResponse('Failed to load Google integration status', 500);
    }
  },
  { permissions: ['VIEW_ORDERS'] }
);
