export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';

export const GET = withAuth(
  async (req: NextRequest, user, { params }: { params: { key: string } }) => {
    try {
      const snippet = await prisma.helpSnippet.findFirst({
        where: { key: params.key },
      });

      if (!snippet || !snippet.isActive) {
        return createErrorResponse('Help snippet not found', 404);
      }

      return createSuccessResponse(snippet);
    } catch (error) {
      console.error('Failed to fetch help snippet:', error);
      return createErrorResponse('Failed to fetch help snippet', 500);
    }
  }
);
