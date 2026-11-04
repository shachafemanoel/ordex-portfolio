import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { CalendarEventKind } from '@prisma/client';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser, context: { params: Promise<{ id: string }> }) => {
    const params = await context.params;
    try {
      const [messageLogs, installationEvent] = await Promise.all([
        prisma.messageLog.findMany({
          where: { orderId: params.id, channel: 'EMAIL' },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            template: { select: { id: true, name: true } },
            createdByUser: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.calendarEvent.findFirst({
          where: { orderId: params.id, eventKind: CalendarEventKind.INSTALLATION },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

      return createSuccessResponse({
        messageLogs,
        installationCalendarEvent: installationEvent,
      });
    } catch (e) {
      console.error('[operational-comms]', e);
      return createErrorResponse('Failed to load communications', 500);
    }
  },
  { permissions: ['VIEW_ORDERS'] }
);
