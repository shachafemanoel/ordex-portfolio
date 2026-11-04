export const dynamic = 'force-dynamic';

import { normalizeRole } from '@/domain/roles/normalizeRole';
import { normalizeUser } from '@/domain/users/normalizeUser';
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withAuth,
} from '@/lib/api-middleware';
import { auditUpdate } from '@/lib/audit';
import type { AuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const UpdateRoleRequest = z.object({
  role: z.string(),
});

export const PATCH = withAuth(
  async (request: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const body = await request.json();
      const parsed = UpdateRoleRequest.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse('Invalid role specified', 400, parsed.error.flatten());
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: params.id },
      });

      if (!existingUser) {
        return createErrorResponse('User not found', 404);
      }

      const normalizedRole = normalizeRole(parsed.data.role);

      if (!normalizedRole) {
        return createErrorResponse('Invalid role specified', 400);
      }

      const updatedUser = await prisma.user.update({
        where: { id: params.id },
        data: { role: normalizedRole.key },
        include: {
          _count: {
            select: { assignedOrders: true },
          },
        },
      });

      // Audit log the role change
      await auditUpdate({
        entity: 'User',
        entityId: params.id,
        actorId: user.id,
        before: { role: existingUser.role },
        after: { role: normalizedRole.key },
      });

      return createSuccessResponse(
        { user: normalizeUser(updatedUser as any) },
        undefined,
        'User role updated successfully'
      );
    } catch (error) {
      return handleApiError(error, request);
    }
  },
  { roles: ['ADMIN'] }
);
