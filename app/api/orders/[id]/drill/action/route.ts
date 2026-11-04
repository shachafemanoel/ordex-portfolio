export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import {
  canExecuteAction,
  getActionTransition,
  type OpsWorkflowAction,
} from '@/lib/orders/ops/workflowStateMachine';
import { buildOrderSnapshot } from '@/lib/orders/rules/orderSnapshot';
import { ORDER_ACTION_HANDLERS } from '@/lib/server/actions/orderActionHandlers';
import { computeDrillState } from '@/lib/services/orders-ops';
import { syncOrderOperationalState } from '@/lib/services/orders/statusRecalculation';
import { OperationalEmailService } from '@/lib/services/operational/OperationalEmailService';
import { DEFAULT_WORKSPACE_STORE_ID } from '@/lib/services/google-workspace/InstallationGoogleCalendarService';
import {
  GoogleWorkspaceIntegrationStatus,
  MessageTemplateTarget,
  NotificationChannel,
} from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const CANONICAL_ACTION_IDS = [
  'accept-to-production',
  'goods-accepted',
  'mark-ready-delivery',
  'send-to-supplier',
  'mark-customer-contacted',
  'mark-supplied',
  'awaiting-stock',
  'awaiting-customer',
  'update-address',
  'update-payment',
  'schedule-installation',
  'mark-picked',
  'mark-delivered',
  'force-approve-preparation',
] as const;

const AddressActionPayloadSchema = z.object({
  city: z.string().min(2),
  street: z.string().min(2),
  number: z.string().min(1),
  floor: z.string().optional(),
  apartment: z.string().optional(),
  notes: z.string().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});

const PaymentActionPayloadSchema = z.object({
  method: z.string().min(1),
  amountCents: z.number().int().min(0),
  status: z.enum(['PENDING', 'AUTHORIZED', 'PAID', 'PARTIAL', 'FAILED', 'REFUNDED']),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const ScheduleInstallationPayloadSchema = z.object({
  scheduledAt: z.string().datetime(),
  installerId: z.string().optional().nullable(),
  installerName: z.string().optional().nullable(),
  installerNotes: z.string().optional().nullable(),
  address: z
    .object({
      city: z.string().min(1),
      street: z.string().min(1),
      number: z.string().min(1),
      floor: z.string().optional(),
      lat: z.number().nullable().optional(),
      lng: z.number().nullable().optional(),
    })
    .optional(),
});

const DrillActionSchema = z.object({
  actionId: z.string().trim().min(1),
  estimatedDays: z.coerce.number().int().min(1).max(60).optional(),
  deliveryDate: z.string().datetime().optional(),
  templateId: z.string().uuid().optional(),
  payload: z.unknown().optional(),
});

type DrillActionId = (typeof CANONICAL_ACTION_IDS)[number];

const LEGACY_ACTION_ALIASES: Record<string, DrillActionId> = {
  'create-purchase-order': 'accept-to-production',
  'approve-items': 'accept-to-production',
  'receive-goods': 'goods-accepted',
  'mark-picked-for-delivery': 'mark-picked',
  'complete-delivery': 'mark-delivered',
};

const ACTIONS_REQUIRING_OPS_SYNC = new Set<DrillActionId>([
  'goods-accepted',
  'mark-ready-delivery',
  'update-address',
  'schedule-installation',
  'mark-picked',
  'mark-delivered',
  'force-approve-preparation',
]);

function normalizeActionId(actionId: string): DrillActionId | null {
  if ((CANONICAL_ACTION_IDS as readonly string[]).includes(actionId)) {
    return actionId as DrillActionId;
  }

  return LEGACY_ACTION_ALIASES[actionId] ?? null;
}

async function getOrderForDrill(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shippingAddress: true,
      calendarEvents: true,
      payments: true,
    },
  });
}

async function getDrillStateForOrder(orderId: string) {
  const order = await getOrderForDrill(orderId);
  if (!order) return null;

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      linkedOrderIds: { has: order.id },
    },
    select: {
      status: true,
    },
  });

  const snapshot = buildOrderSnapshot({
    ...order,
    relatedPurchaseOrders: purchaseOrders as any,
  });

  const drillState = computeDrillState({
    snapshot,
    opsChecklistState: order.opsChecklistState as Record<string, Record<string, boolean>> | null,
    opsSnoozeUntil: order.opsSnoozeUntil,
    opsSnoozeReason: order.opsSnoozeReason,
  });

  return { order, drillState };
}

async function handleAction(
  orderId: string,
  actionId: DrillActionId,
  payload: {
    estimatedDays?: number;
    deliveryDate?: string;
    templateId?: string;
    actionPayload?: unknown;
    userId: string;
  }
) {
  const now = new Date();

  if (actionId === 'accept-to-production') {
    const etaDays = payload.estimatedDays ?? 3;
    const estimatedDate = new Date(now);
    estimatedDate.setDate(estimatedDate.getDate() + etaDays);

    await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId } });

      for (const item of items) {
        if (item.receivedQuantity >= item.qty) continue;
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            sentToSupplierAt: now,
            estimatedSupplyAt: estimatedDate,
            allocationStatus: 'ON_ORDER',
          },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'AWAITING_STOCK',
          scheduledAt: estimatedDate,
          lastActionAt: now,
          opsLane: 'WAITING',
        },
      });
    });
    return;
  }

  if (actionId === 'awaiting-stock') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'AWAITING_STOCK',
        lastActionAt: now,
        opsLane: 'WAITING',
      },
    });
    return;
  }

  if (actionId === 'awaiting-customer') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CALL_BACK',
        lastActionAt: now,
        opsLane: 'WAITING',
      },
    });
    return;
  }

  if (actionId === 'goods-accepted') {
    await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId } });

      for (const item of items) {
        if (item.receivedQuantity >= item.qty) continue;
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            receivedQuantity: item.qty,
          },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'INSTALL_SCHEDULING',
          lastActionAt: now,
          opsLane: 'NEEDS_ACTION',
        },
      });
    });
    return;
  }

  if (actionId === 'mark-ready-delivery') {
    const deliveryDate = payload.deliveryDate ? new Date(payload.deliveryDate) : null;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'AWAITING_INSTALL',
        scheduledAt: deliveryDate ?? now,
        lastActionAt: now,
        opsLane: 'READY',
      },
    });
    return;
  }

  if (actionId === 'mark-customer-contacted') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PROCESSING',
        lastActionAt: now,
        opsLane: 'NEEDS_ACTION',
      },
    });
    return;
  }

  if (actionId === 'mark-supplied') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        lastActionAt: now,
        opsLane: 'READY',
      },
    });
    return;
  }

  if (actionId === 'mark-picked') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'IN_TRANSIT',
        lastActionAt: now,
        opsLane: 'NEEDS_ACTION',
      },
    });
    return;
  }

  if (actionId === 'mark-delivered') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        lastActionAt: now,
        opsLane: null,
      },
    });
    return;
  }

  if (actionId === 'send-to-supplier') {
    let template;
    if (payload.templateId) {
      template = await prisma.messageTemplate.findUnique({
        where: { id: payload.templateId },
      });
    } else {
      template = await prisma.messageTemplate.findFirst({
        where: {
          target: MessageTemplateTarget.SUPPLIER,
          channel: NotificationChannel.EMAIL,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!template) {
      throw new Error('No email template found for supplier');
    }

    if (template.channel !== NotificationChannel.EMAIL) {
      throw new Error('Supplier send requires an EMAIL channel template');
    }

    const integration = await prisma.workspaceGoogleIntegration.findUnique({
      where: { storeId: DEFAULT_WORKSPACE_STORE_ID },
    });

    if (integration?.status !== GoogleWorkspaceIntegrationStatus.ACTIVE) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, customer: true, shippingAddress: true },
      });
      if (!order) throw new Error('Order not found');

      let body = template.content;
      body = body.replace(/{{orderNumber}}/g, order.orderNumber || order.number);
      body = body.replace(/{{customerName}}/g, order.customer?.name || order.customerName || '');
      body = body.replace(/{{city}}/g, order.shippingAddress?.city || '');
      const itemsList = order.items.map((i) => `- ${i.sku}: ${i.qty}`).join('\n');
      body = body.replace(/{{items}}/g, itemsList);

      await prisma.messageLog.create({
        data: {
          orderId: order.id,
          templateId: template.id,
          channel: template.channel,
          to: 'SUPPLIER',
          subject: template.subject,
          body,
          status: 'SENT',
          sentAt: new Date(),
          createdBy: payload.userId,
        },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { lastActionAt: new Date() },
      });
      return;
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { linkedOrderIds: { has: orderId } },
      include: { supplier: true },
      orderBy: { updatedAt: 'desc' },
    });
    const supplierEmail = po?.supplier?.email?.trim();
    if (!supplierEmail) {
      throw new Error('No supplier email on a purchase order linked to this order');
    }

    const opEmail = new OperationalEmailService();
    await opEmail.send({
      storeId: DEFAULT_WORKSPACE_STORE_ID,
      actorUserId: payload.userId,
      orderId,
      purchaseOrderId: po?.id ?? null,
      supplierId: po?.supplierId ?? null,
      templateId: template.id,
      to: supplierEmail,
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { lastActionAt: new Date() },
    });
    return;
  }

  if (actionId === 'update-address') {
    const handler = ORDER_ACTION_HANDLERS['update-address'];
    if (!handler) throw new Error('update-address handler is not configured');
    await handler(orderId, payload.actionPayload, payload.userId);
    return;
  }

  if (actionId === 'update-payment') {
    const handler = ORDER_ACTION_HANDLERS['update-payment'];
    if (!handler) throw new Error('update-payment handler is not configured');
    await handler(orderId, payload.actionPayload, payload.userId);
    return;
  }

  if (actionId === 'schedule-installation') {
    const handler = ORDER_ACTION_HANDLERS['schedule-installation'];
    if (!handler) throw new Error('schedule-installation handler is not configured');
    await handler(orderId, payload.actionPayload, payload.userId);
    return;
  }

  if (actionId === 'force-approve-preparation') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PROCESSING',
        lastActionAt: now,
        opsLane: 'NEEDS_ACTION',
      },
    });
    return;
  }

  throw new Error(`Unsupported action: ${actionId}`);
}

/**
 * POST /api/orders/:id/drill/action
 *
 * Executes explicit state-machine actions from Smart Drill.
 */
export const POST = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const { id } = params;
      const body = await req.json();
      const parsed = DrillActionSchema.safeParse(body);

      if (!parsed.success) {
        return createErrorResponse('Invalid action payload', 400, {
          ...parsed.error.flatten(),
          receivedActionId: typeof body?.actionId === 'string' ? body.actionId : null,
          supportedActions: CANONICAL_ACTION_IDS,
        });
      }

      const { actionId: rawActionId, estimatedDays, templateId, deliveryDate } = parsed.data;
      const actionId = normalizeActionId(rawActionId);
      if (!actionId) {
        return createErrorResponse('Invalid action payload', 400, {
          formErrors: [`Unsupported actionId "${rawActionId}"`],
          fieldErrors: {
            actionId: [`Supported actions: ${CANONICAL_ACTION_IDS.join(', ')}`],
          },
          receivedActionId: rawActionId,
          normalizedActionId: null,
          supportedActions: CANONICAL_ACTION_IDS,
        });
      }

      if (
        actionId === 'send-to-supplier' &&
        !user.permissions.includes('SEND_OPERATIONAL_EMAIL')
      ) {
        return createErrorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
      }

      let actionPayload: unknown = parsed.data.payload;
      if (actionId === 'update-address') {
        const normalized = AddressActionPayloadSchema.safeParse(parsed.data.payload);
        if (!normalized.success) {
          return createErrorResponse(
            'Invalid payload for update-address',
            400,
            normalized.error.flatten()
          );
        }
        actionPayload = normalized.data;
      }

      if (actionId === 'update-payment') {
        const normalized = PaymentActionPayloadSchema.safeParse(parsed.data.payload);
        if (!normalized.success) {
          return createErrorResponse(
            'Invalid payload for update-payment',
            400,
            normalized.error.flatten()
          );
        }
        actionPayload = normalized.data;
      }

      if (actionId === 'schedule-installation') {
        const payloadObject =
          typeof parsed.data.payload === 'object' && parsed.data.payload !== null
            ? (parsed.data.payload as Record<string, unknown>)
            : {};
        const payloadScheduledAt =
          typeof payloadObject.scheduledAt === 'string' ? payloadObject.scheduledAt : undefined;
        const scheduleCandidate = {
          ...payloadObject,
          scheduledAt: payloadScheduledAt ?? deliveryDate,
        };
        const normalized = ScheduleInstallationPayloadSchema.safeParse(scheduleCandidate);
        if (!normalized.success) {
          return createErrorResponse(
            'Invalid payload for schedule-installation',
            400,
            normalized.error.flatten()
          );
        }
        actionPayload = normalized.data;
      }

      const before = await getDrillStateForOrder(id);
      if (!before) {
        return createErrorResponse('Order not found', 404);
      }

      // Special handling for actions that are not state transitions
      const nonTransitionActions: string[] = [
        'send-to-supplier',
        'update-address',
        'update-payment',
        'schedule-installation',
        'mark-picked',
        'mark-delivered',
        'force-approve-preparation',
      ];

      if (!nonTransitionActions.includes(actionId)) {
        const currentStatus = before.order.status;
        const transition = getActionTransition(actionId as OpsWorkflowAction);

        if (!canExecuteAction(currentStatus, actionId as OpsWorkflowAction)) {
          return createErrorResponse(
            `Action "${actionId}" is not allowed from status "${currentStatus}"`,
            400
          );
        }

        // Action gating: must complete checklist before production acceptance
        if (transition.requiresChecklistCompletion && before.drillState.progressPct < 100) {
          return createErrorResponse('Checklist must be completed before acceptance', 400);
        }

        if (transition.requiresEstimatedDays && !estimatedDays) {
          return createErrorResponse('estimatedDays is required for this action', 400);
        }
      }

      await handleAction(id, actionId, {
        estimatedDays,
        templateId,
        deliveryDate,
        actionPayload,
        userId: user.id,
      });

      if (ACTIONS_REQUIRING_OPS_SYNC.has(actionId)) {
        await syncOrderOperationalState(id, {
          actorId: user.id,
          reason: `Drill action: ${actionId}`,
        });
      }

      // Log the action
      try {
        await prisma.orderLog.create({
          data: {
            orderId: id,
            userId: user.id,
            action: actionId,
            metadata: {
              checklist: before.drillState.currentTask.steps,
              taskLabel: before.drillState.currentTask.taskLabel,
              payload: parsed.data.payload,
            } as any,
          },
        });
      } catch (logError) {
        console.error('Failed to create order log:', logError);
        // Do not fail the request if logging fails
      }

      const after = await getDrillStateForOrder(id);
      if (!after) {
        return createErrorResponse('Order not found after update', 404);
      }

      return createSuccessResponse({
        actionId,
        sourceActionId: rawActionId,
        order: {
          id: after.order.id,
          number: after.order.number,
          status: after.order.status,
          scheduledAt: after.order.scheduledAt,
          updatedBy: user.id,
        },
        drillState: after.drillState,
      });
    } catch (error) {
      console.error('Failed to execute drill action:', error);
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to execute drill action',
        500
      );
    }
  }
);
