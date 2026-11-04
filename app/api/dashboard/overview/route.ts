import { createDataResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { getProductionDashboardService } from '@/lib/services/production';

const dashboardService = getProductionDashboardService();

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => {
  try {
    const data = await dashboardService.getOverview();
    return createDataResponse(data);
  } catch (error: any) {
    logger.error('[GET /api/dashboard/overview] failed', { error: error?.message });
    // Return empty/minimal structure or 500, but do NOT return fake stub data with 0s everywhere automatically
    // unless we want graceful degradation. User requested "Dashboard Overview Stub Data" fix.
    // The previous code returned "fallback" with 0s.
    // We will now allow the error to bubble or return a minimal valid structure if preferred,
    // but without masking the problem.
    // Actually, let's just return 500 to signal failure so it can be fixed.
    throw error;
  }
});
