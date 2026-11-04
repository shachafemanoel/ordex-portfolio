export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { AnnouncementAudience } from '@prisma/client';

const CreateAnnouncementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: z.nativeEnum(AnnouncementAudience),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  isActive: z.boolean().optional(),
});

export const GET = withAuth(
  async () => {
    try {
      const announcements = await prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return createSuccessResponse(announcements);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      return createErrorResponse('Failed to fetch announcements', 500);
    }
  },
  { roles: ['ADMIN'] }
);

export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const parsed = CreateAnnouncementSchema.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse('Invalid request', 400, parsed.error.flatten());
      }

      const announcement = await prisma.announcement.create({
        data: parsed.data,
      });

      return createSuccessResponse(announcement);
    } catch (error) {
      console.error('Failed to create announcement:', error);
      return createErrorResponse('Failed to create announcement', 500);
    }
  },
  { roles: ['ADMIN'] }
);
