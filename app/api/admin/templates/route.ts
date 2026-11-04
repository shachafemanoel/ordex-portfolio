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

const CreateTemplateSchema = z
  .object({
    name: z.string().min(1),
    channel: z.nativeEnum(NotificationChannel),
    target: z.nativeEnum(MessageTemplateTarget),
    subject: z.string().max(998).optional(),
    content: z.string().min(1),
    operationalKind: z.nativeEnum(OperationalMessageKind).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channel === NotificationChannel.EMAIL && !data.subject?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'subject is required for EMAIL templates',
        path: ['subject'],
      });
    }
  });

export const GET = withAuth(
  async () => {
    try {
      const templates = await prisma.messageTemplate.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return createSuccessResponse(templates);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      return createErrorResponse('Failed to fetch templates', 500);
    }
  },
  { roles: ['ADMIN'] }
);

export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const parsed = CreateTemplateSchema.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse('Invalid request', 400, parsed.error.flatten());
      }

      const template = await prisma.messageTemplate.create({
        data: parsed.data,
      });

      return createSuccessResponse(template);
    } catch (error) {
      console.error('Failed to create template:', error);
      return createErrorResponse('Failed to create template', 500);
    }
  },
  { roles: ['ADMIN'] }
);
