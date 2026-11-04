export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { completeTask } from '@/lib/tasks/orderTaskService';

export const POST = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const { id } = params;
      const body = await req.json();
      const { taskId, actionChoice, override } = body;

      if (!taskId) {
        return createErrorResponse('taskId is required', 400);
      }

      const result = await completeTask(id, {
        taskId,
        performedByUserId: user.id,
        actionChoice,
        override,
      });

      if (result.blocked) {
        return createSuccessResponse({
          success: false,
          blocked: true,
          missingItems: result.missingItems,
        });
      }

      return createSuccessResponse({
        success: true,
        completedTask: result.completedTask,
        nextTask: result.nextTask,
      });
    } catch (error: any) {
      console.error('Error completing task:', error);
      return createErrorResponse(error.message, 500);
    }
  }
);
