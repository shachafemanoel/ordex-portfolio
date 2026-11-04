import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { updateInstallationTaskStatus } from '@/lib/installations/workCalendar';
import { mapErrorToResponse } from '@/lib/server/errors';
import { InstallationTaskStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.nativeEnum(InstallationTaskStatus),
});

export const PATCH = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const parsed = patchSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: { message: 'Invalid request body', details: parsed.error.issues },
          },
          { status: 400 }
        );
      }

      const orderId = await updateInstallationTaskStatus({
        taskId: params.id,
        status: parsed.data.status,
        actorId: user.id,
      });

      return NextResponse.json({
        success: true,
        data: {
          taskId: params.id,
          orderId,
          status: parsed.data.status,
        },
      });
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      if (error instanceof Error && error.message === 'Task not found') {
        return NextResponse.json(
          {
            success: false,
            error: { message: 'Task not found' },
          },
          { status: 404 }
        );
      }

      console.error('Failed to update work calendar task:', error);
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Failed to update work calendar task' },
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);
