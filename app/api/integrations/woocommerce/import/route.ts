import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { storeErrorResponse } from '@/lib/integrations/woocommerce/api';
import { approveImport, ImportInput } from '@/lib/integrations/woocommerce/import';
export const dynamic = 'force-dynamic';
export const POST = withAuth(
  async (req) => {
    try {
      const input = ImportInput.safeParse(await req.json().catch(() => null));
      if (!input.success) return createErrorResponse('יש לאשר ייבוא לאחר תצוגה מקדימה', 400);
      return createSuccessResponse(
        await approveImport(input.data.previewId),
        undefined,
        'הייבוא נוסף לתור'
      );
    } catch (error) {
      return storeErrorResponse(error);
    }
  },
  { roles: ['ADMIN'] }
);
