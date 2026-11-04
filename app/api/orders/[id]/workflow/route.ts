export const dynamic = 'force-dynamic';

import { createDataResponse, createErrorResponse, withErrorHandler } from '@/lib/api-middleware';
import { getCurrentUser } from '@/lib/auth/verifySession';
import { prisma } from '@/lib/db';
import { canTransitionTo } from '@/lib/workflow-gates';
import { WorkflowStage } from '@/lib/workflow-status';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const WorkflowTransitionSchema = z.object({
  targetStage: z.nativeEnum(WorkflowStage),
  override: z.boolean().optional(),
  reason: z.string().optional(),
  taskLabel: z.string().nullable().optional(),
});

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
      return createErrorResponse('Unauthorized', 401);
    }

    const body = await req.json();
    const validation = WorkflowTransitionSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('Validation Error', 400, validation.error.format());
    }

    const { targetStage, override, reason, taskLabel } = validation.data;
    const orderId = params.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return createErrorResponse('Order not found', 404);
    }

    // Check gates if stage is changing
    if (order.stage !== targetStage) {
      const { allowed, missing } = canTransitionTo(order, targetStage);

      if (!allowed && !override) {
        return createErrorResponse('Workflow Gates Failed', 403, {
          missingRequirements: missing,
          message: 'Cannot transition to this stage. Complete checklist or use manager override.',
        });
      }

      if (!allowed && override) {
        if (!reason) {
          return createErrorResponse('Override requires a reason', 400);
        }

        await prisma.eventLog.create({
          data: {
            orderId,
            userId: user.id,
            type: 'OVERRIDE_GATE',
            payload: {
              from: order.stage,
              to: targetStage,
              reason,
              missing: missing.map((m) => m.id),
            },
          },
        });
      } else {
        // Normal transition or allowed transition
        await prisma.eventLog.create({
          data: {
            orderId,
            userId: user.id,
            type: 'STAGE_CHANGE',
            payload: {
              from: order.stage,
              to: targetStage,
              taskLabel: taskLabel ?? undefined,
            },
          },
        });
      }
    } else if (taskLabel !== undefined && taskLabel !== order.taskLabel) {
      // Update task label only
      await prisma.eventLog.create({
        data: {
          orderId,
          userId: user.id,
          type: 'TASK_LABEL_CHANGE',
          payload: {
            from: order.taskLabel,
            to: taskLabel,
          },
        },
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        stage: targetStage,
        taskLabel: taskLabel === undefined ? order.taskLabel : taskLabel, // If undefined keep existing, if null set null
      },
    });

    return createDataResponse(updatedOrder, req);
  }
);
