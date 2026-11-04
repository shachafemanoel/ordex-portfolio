export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const UpdateHelpSnippetSchema = z.object({
  key: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  context: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const PUT = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const parsed = UpdateHelpSnippetSchema.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse('Invalid request', 400, parsed.error.flatten());
      }

      const snippet = await prisma.helpSnippet.update({
        where: { id: params.id },
        data: parsed.data,
      });

      return createSuccessResponse(snippet);
    } catch (error) {
      console.error('Failed to update help snippet:', error);
      if ((error as any).code === 'P2002') {
        return createErrorResponse('Key must be unique', 409);
      }
      return createErrorResponse('Failed to update help snippet', 500);
    }
  },
  { roles: ['ADMIN'] }
);

export const DELETE = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      await prisma.helpSnippet.delete({
        where: { id: params.id },
      });
      return createSuccessResponse({ success: true });
    } catch (error) {
      console.error('Failed to delete help snippet:', error);
      return createErrorResponse('Failed to delete help snippet', 500);
    }
  },
  { roles: ['ADMIN'] }
);
