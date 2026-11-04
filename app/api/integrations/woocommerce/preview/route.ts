import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { storeErrorResponse } from '@/lib/integrations/woocommerce/api';
import { previewImport, PreviewInput } from '@/lib/integrations/woocommerce/import';
export const dynamic = 'force-dynamic';
export const POST = withAuth(
  async (req) => {
    try {
      const input = PreviewInput.safeParse(await req.json().catch(() => null));
      if (!input.success) return createErrorResponse('בקשה לא תקינה', 400);
      return createSuccessResponse(await previewImport(input.data));
    } catch (error) {
      return storeErrorResponse(error);
    }
  },
  { roles: ['ADMIN'] }
);
