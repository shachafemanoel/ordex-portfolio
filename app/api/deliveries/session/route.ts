import { UserRole } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import {
  getActiveDeliveryRouteSession,
  startDeliveryRouteSession,
  updateActiveDeliveryRouteSession,
} from '@/src/server/services/delivery-route-session.service';

export const dynamic = 'force-dynamic';

const allowedRoles = [UserRole.ADMIN, UserRole.INSTALLER, UserRole.OPERATIONS] as const;

export const GET = withAuth(
  async (_req, user) => {
    const session = await getActiveDeliveryRouteSession(user.id);
    return createSuccessResponse(session);
  },
  { roles: allowedRoles }
);

export const POST = withAuth(
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const session = await startDeliveryRouteSession(user.id, body);
      return createSuccessResponse(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid delivery session payload', 400, error.flatten());
      }

      logger.error('[POST /api/deliveries/session] failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'deliveries-session-api',
        userId: user.id,
      });

      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to start delivery session',
        500
      );
    }
  },
  { roles: allowedRoles }
);

export const PATCH = withAuth(
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const session = await updateActiveDeliveryRouteSession(user.id, body);
      return createSuccessResponse(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid delivery session action payload', 400, error.flatten());
      }

      logger.error('[PATCH /api/deliveries/session] failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'deliveries-session-api',
        userId: user.id,
      });

      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to update delivery session',
        500
      );
    }
  },
  { roles: allowedRoles }
);
