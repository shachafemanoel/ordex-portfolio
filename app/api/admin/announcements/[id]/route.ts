export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { AnnouncementAudience } from '@prisma/client';

const UpdateAnnouncementSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  audience: z.nativeEnum(AnnouncementAudience).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const PUT = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const parsed = UpdateAnnouncementSchema.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse('Invalid request', 400, parsed.error.flatten());
      }

      const announcement = await prisma.announcement.update({
        where: { id: params.id },
        data: parsed.data,
      });

      return createSuccessResponse(announcement);
    } catch (error) {
      console.error('Failed to update announcement:', error);
      return createErrorResponse('Failed to update announcement', 500);
    }
  },
  { roles: ['ADMIN'] }
);

export const DELETE = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      await prisma.announcement.delete({
        where: { id: params.id },
      });
      return createSuccessResponse({ success: true });
    } catch (error) {
      console.error('Failed to delete announcement:', error);
      return createErrorResponse('Failed to delete announcement', 500);
    }
  },
  { roles: ['ADMIN'] }
);
