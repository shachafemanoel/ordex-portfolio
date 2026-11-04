import { createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { storeErrorResponse } from '@/lib/integrations/woocommerce/api';
import { retryJob } from '@/lib/integrations/woocommerce/operations';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const POST = withAuth(
  async (_req, _user, { params }: { params: { id: string } }) => {
    try {
      return createSuccessResponse(await retryJob(z.string().uuid().parse(params.id)));
    } catch (error) {
      return storeErrorResponse(error);
    }
  },
  { roles: ['ADMIN'] }
);
