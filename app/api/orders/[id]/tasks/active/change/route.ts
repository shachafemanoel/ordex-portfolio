export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { setActiveTask, logTaskEvent } from '@/lib/tasks/orderTaskService';

export const POST = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const { id } = params;
      const body = await req.json();
      const { newType, reason } = body;

      if (!newType) {
        return createErrorResponse('newType is required', 400);
      }

      const newTask = await setActiveTask(id, newType, {
        createdByUserId: user.id,
        note: reason,
      });

      await logTaskEvent(id, newTask.id, 'TASK_CHANGED', {
        actorUserId: user.id,
        message: `סוג משימה שונה ל: ${newType}. סיבה: ${reason || 'לא צוינה'}`,
      });

      return createSuccessResponse({
        success: true,
        newTask,
      });
    } catch (error: any) {
      console.error('Error changing task type:', error);
      return createErrorResponse(error.message, 500);
    }
  }
);
