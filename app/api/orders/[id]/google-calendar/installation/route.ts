import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import {
  GoogleIntegrationInvalidError,
  GoogleIntegrationMissingError,
} from '@/lib/integrations/google/errors';
import { prisma } from '@/lib/db';
import { InstallationGoogleCalendarService } from '@/lib/services/google-workspace/InstallationGoogleCalendarService';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

async function handleSync(
  orderId: string,
  user: AuthenticatedUser,
  parsed: z.infer<typeof BodySchema>
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, shippingAddress: true },
  });
  if (!order) {
    return createErrorResponse('Order not found', 404);
  }

  const start = new Date(parsed.startTime);
  const end = parsed.endTime
    ? new Date(parsed.endTime)
    : new Date(start.getTime() + 60 * 60 * 1000);

  const addr = order.shippingAddress;
  const location =
    parsed.location?.trim() ||
    [order.addressLine, order.city].filter(Boolean).join(', ') ||
    (addr ? `${addr.street} ${addr.number}, ${addr.city}` : '') ||
    null;

  const title =
    parsed.title?.trim() ||
    `${order.customerName || order.customer?.name || 'לקוח'} #${order.number}`;

  const description =
    parsed.description?.trim() ??
    order.installerNotes ??
    order.notes ??
    undefined;

  try {
    const svc = new InstallationGoogleCalendarService();
    const result = await svc.syncInstallationEventForOrder(orderId, {
      title,
      description,
      location,
      startTime: start,
      endTime: end,
      createdByUserId: user.id,
    });
    return createSuccessResponse({
      calendarEventId: result.calendarEventId,
      googleSyncStatus: result.googleSyncStatus,
    });
  } catch (e) {
    if (e instanceof GoogleIntegrationMissingError) {
      return createErrorResponse(e.message, 503, { code: e.code });
    }
    if (e instanceof GoogleIntegrationInvalidError) {
      return createErrorResponse(e.message, 409, { code: e.code });
    }
    console.error('[google-calendar/installation]', e);
    return createErrorResponse(e instanceof Error ? e.message : 'Calendar sync failed', 502);
  }
}

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, context: { params: Promise<{ id: string }> }) => {
    const params = await context.params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse('Validation failed', 400, parsed.error.flatten());
    }
    return handleSync(params.id, user, parsed.data);
  },
  { permissions: ['SCHEDULE_ORDERS'] }
);

export const PATCH = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, context: { params: Promise<{ id: string }> }) => {
    const params = await context.params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse('Validation failed', 400, parsed.error.flatten());
    }
    return handleSync(params.id, user, parsed.data);
  },
  { permissions: ['SCHEDULE_ORDERS'] }
);
