export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const UpdateUILabelSchema = z.object({
  value: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const PUT = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const parsed = UpdateUILabelSchema.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse('Invalid request', 400, parsed.error.flatten());
      }

      const label = await prisma.uiLabel.update({
        where: { id: params.id },
        data: parsed.data,
      });

      return createSuccessResponse(label);
    } catch (error) {
      console.error('Failed to update label:', error);
      return createErrorResponse('Failed to update label', 500);
    }
  },
  { roles: ['ADMIN'] }
);

// DELETE not strictly required but good to have if created by mistake
export const DELETE = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      await prisma.uiLabel.delete({
        where: { id: params.id },
      });
      return createSuccessResponse({ success: true });
    } catch (error) {
      console.error('Failed to delete label:', error);
      return createErrorResponse('Failed to delete label', 500);
    }
  },
  { roles: ['ADMIN'] }
);
