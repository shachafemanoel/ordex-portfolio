export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const CreateUILabelSchema = z.object({
  key: z.string().min(1),
  locale: z.string().default('he'),
  value: z.string().min(1),
  isActive: z.boolean().optional(),
});

export const GET = withAuth(
  async () => {
    try {
      const labels = await prisma.uiLabel.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return createSuccessResponse(labels);
    } catch (error) {
      console.error('Failed to fetch labels:', error);
      return createErrorResponse('Failed to fetch labels', 500);
    }
  },
  { roles: ['ADMIN'] }
);

export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const parsed = CreateUILabelSchema.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse('Invalid request', 400, parsed.error.flatten());
      }

      const label = await prisma.uiLabel.create({
        data: parsed.data,
      });

      return createSuccessResponse(label);
    } catch (error) {
      console.error('Failed to create label:', error);
      if ((error as any).code === 'P2002') {
        return createErrorResponse('Key must be unique', 409);
      }
      return createErrorResponse('Failed to create label', 500);
    }
  },
  { roles: ['ADMIN'] }
);
