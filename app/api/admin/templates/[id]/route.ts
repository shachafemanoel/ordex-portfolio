export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import {
  MessageTemplateTarget,
  NotificationChannel,
  OperationalMessageKind,
} from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const UpdateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  channel: z.nativeEnum(NotificationChannel).optional(),
  target: z.nativeEnum(MessageTemplateTarget).optional(),
  subject: z.string().max(998).optional().nullable(),
  content: z.string().min(1).optional(),
  operationalKind: z.nativeEnum(OperationalMessageKind).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const PUT = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const parsed = UpdateTemplateSchema.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse('Invalid request', 400, parsed.error.flatten());
      }

      const existing = await prisma.messageTemplate.findUnique({
        where: { id: params.id },
      });
      if (!existing) {
        return createErrorResponse('Template not found', 404);
      }

      const mergedChannel = parsed.data.channel ?? existing.channel;
      const mergedSubject =
        parsed.data.subject !== undefined ? parsed.data.subject : existing.subject;
      if (mergedChannel === NotificationChannel.EMAIL && !mergedSubject?.trim()) {
        return createErrorResponse('subject is required for EMAIL templates', 400);
      }

      const template = await prisma.messageTemplate.update({
        where: { id: params.id },
        data: parsed.data,
      });

      return createSuccessResponse(template);
    } catch (error) {
      console.error('Failed to update template:', error);
      return createErrorResponse('Failed to update template', 500);
    }
  },
  { roles: ['ADMIN'] }
);

export const DELETE = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      await prisma.messageTemplate.delete({
        where: { id: params.id },
      });
      return createSuccessResponse({ success: true });
    } catch (error) {
      console.error('Failed to delete template:', error);
      return createErrorResponse('Failed to delete template', 500);
    }
  },
  { roles: ['ADMIN'] }
);
