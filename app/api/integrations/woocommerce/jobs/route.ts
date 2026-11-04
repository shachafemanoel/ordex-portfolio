import { createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { storeErrorResponse } from '@/lib/integrations/woocommerce/api';
import { listJobs } from '@/lib/integrations/woocommerce/operations';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const GET = withAuth(
  async (req) => {
    try {
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .parse(req.nextUrl.searchParams.get('page') ?? 1);
      return createSuccessResponse(await listJobs(page));
    } catch (error) {
      return storeErrorResponse(error);
    }
  },
  { roles: ['ADMIN'] }
);
