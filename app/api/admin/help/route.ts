export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const CreateHelpSnippetSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  context: z.string().min(1),
  isActive: z.boolean().optional(),
});

export const GET = withAuth(
  async () => {
    try {
      const snippets = await prisma.helpSnippet.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return createSuccessResponse(snippets);
    } catch (error) {
      console.error('Failed to fetch help snippets:', error);
      return createErrorResponse('Failed to fetch help snippets', 500);
    }
  },
  { roles: ['ADMIN'] }
);

export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const parsed = CreateHelpSnippetSchema.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse('Invalid request', 400, parsed.error.flatten());
      }

      const snippet = await prisma.helpSnippet.create({
        data: parsed.data,
      });

      return createSuccessResponse(snippet);
    } catch (error) {
      console.error('Failed to create help snippet:', error);
      // Check for unique constraint violation (P2002)
      if ((error as any).code === 'P2002') {
        return createErrorResponse('Key must be unique', 409);
      }
      return createErrorResponse('Failed to create help snippet', 500);
    }
  },
  { roles: ['ADMIN'] }
);
