import { prisma } from '@/lib/db';
import { StatusGuard } from '@/lib/services/orders/StatusGuard';
import { PipelineStage } from '@/lib/types/pipeline';
import { ActionPayload, BlockedReasonCode, SupplyChainAction } from '@/lib/types/supply-chain';
import { Order, OrderStatus, TaskStatus, TaskType } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

const PIPELINE_STAGE_DEFINITIONS: { id: string; label: string; statuses: OrderStatus[] }[] = [
  {
    id: 'intake',
    label: 'קליטה וטיפול',
    statuses: ['RECEIVED', 'PROCESSING'],
  },
  {
    id: 'logistics',
    label: 'לוגיסטיקה והפצה',
    statuses: ['READY', 'IN_TRANSIT'],
  },
  {
    id: 'installation',
    label: 'התקנה',
    statuses: ['INSTALLATION'],
  },
  {
    id: 'done',
    label: 'הושלם',
    statuses: ['COMPLETED'],
  },
];

const WARNING_THRESHOLD = 15;

const getInitials = (name?: string) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const formatRelative = (date?: Date | null) => {
  if (!date) return undefined;
  return formatDistanceToNow(date, { addSuffix: true, locale: he });
};

export class SupplyChainService {
  /**
   * Aggregate order counts by stage for the dashboard supply chain pipeline
   */
  async getPipelineStats(): Promise<PipelineStage[]> {
    const grouped = await prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { deletedAt: null },
    });

    const statusCounts = grouped.reduce<Record<string, number>>((acc, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, {});

    const stageMeta = await Promise.all(
      PIPELINE_STAGE_DEFINITIONS.map(async (stage) => {
        const latest = await prisma.order.findFirst({
          where: { status: { in: stage.statuses }, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          select: {
            updatedAt: true,
            assignedUser: { select: { name: true } },
          },
        });

        return {
          id: stage.id,
          lastUpdated: formatRelative(latest?.updatedAt),
          assignee: latest?.assignedUser
            ? {
                name: latest.assignedUser.name,
                initials: getInitials(latest.assignedUser.name),
              }
            : undefined,
        };
      })
    );

    // Determine the first active stage (earliest stage with volume, excluding done)
    const stageOrder = PIPELINE_STAGE_DEFINITIONS.map((stage) => stage.id);
    const firstActiveIndex = stageOrder.findIndex((id, idx) => {
      if (id === 'done') return false;
      const def = PIPELINE_STAGE_DEFINITIONS[idx];
      const value = def.statuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);
      return value > 0;
    });

    return PIPELINE_STAGE_DEFINITIONS.map((stage, index) => {
      const value = stage.statuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);
      const meta = stageMeta.find((m) => m.id === stage.id);

      let status: PipelineStage['status'] = 'pending';
      const isWarning = value > WARNING_THRESHOLD;

      if (stage.id === 'done') {
        status = value > 0 ? 'completed' : 'pending';
      } else if (isWarning) {
        status = 'warning';
      } else if (firstActiveIndex === -1) {
        status = value > 0 ? 'pending' : 'pending';
      } else if (index === firstActiveIndex && value > 0) {
        status = 'active';
      } else if (index < firstActiveIndex) {
        status = 'completed';
      } else {
        status = value > 0 ? 'pending' : 'pending';
      }

      return {
        id: stage.id,
        label: stage.label,
        value,
        status,
        lastUpdated: meta?.lastUpdated,
        assignee: meta?.assignee,
      };
    });
  }

  async executeAction(
    orderId: string,
    action: SupplyChainAction,
    payload: ActionPayload,
    userId: string
  ) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const guardResult = StatusGuard.canExecuteAction(order, action, {
      userId,
      userRole: user.role,
    });

    if (!guardResult.allowed) {
      throw new Error(`Action not allowed: ${guardResult.reason}`);
    }

    // Execute Logic based on action
    switch (action) {
      case SupplyChainAction.RECORD_PAYMENT:
        await this.handleRecordPayment(order, payload, userId);
        break;
      case SupplyChainAction.CANCEL_ORDER:
        await this.handleCancelOrder(order, payload, userId);
        break;

      case SupplyChainAction.CREATE_PURCHASE_ORDER:
        await this.handleCreatePO(order, payload, userId);
        break;

      case SupplyChainAction.REPORT_STOCK_ISSUE:
        await this.blockOrder(order.id, userId, BlockedReasonCode.OUT_OF_STOCK, payload.note);
        break;

      case SupplyChainAction.APPROVE_PHASE_TRANSITION:
        await this.handleTransition(order, userId);
        break;

      case SupplyChainAction.RESOLVE_EXCEPTION:
        await this.unblockOrder(order.id, userId, payload.note);
        break;

      case SupplyChainAction.ASSIGN_SUPPLIER:
        await this.handleAssignSupplier(order, payload, userId);
        break;

      // ... Add handlers for other actions
    }

    // Create Audit Event
    await (prisma as any).auditEvent.create({
      data: {
        orderId: order.id,
        action,
        actorId: userId,
        payload: { entity: 'ORDER', entityId: order.id } as any,
      },
    });
  }

  private async handleRecordPayment(order: Order, payload: ActionPayload, userId: string) {
    // Logic to record payment
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID', // Simplified
        paidAmountCents: { increment: payload.metadata?.amount || 0 },
      },
    });
  }

  private async handleCancelOrder(order: Order, payload: ActionPayload, userId: string) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        statusSub: 'CANCELLED',
      },
    });
  }

  private async handleCreatePO(order: Order, payload: ActionPayload, userId: string) {
    // Logic to create PO
    // Create mandatory task for next day check
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await prisma.task.create({
      data: {
        notes: `Check PO Status for Order #${order.number}. Verify if supplier accepted the PO`,
        orderId: order.id,
        dueAt: tomorrow,
        assigneeId: userId,
        status: TaskStatus.OPEN,
        priority: 'HIGH', // Use string if enum doesn't map directly or TaskPriority.HIGH
        type: TaskType.OTHER,
      },
    });
  }

  private async handleAssignSupplier(order: Order, payload: ActionPayload, userId: string) {
    const { itemId, supplierId } = payload.metadata || {};
    if (!itemId || !supplierId) {
      throw new Error('Missing itemId or supplierId for assignment');
    }

    // Verify item belongs to order
    const count = await prisma.orderItem.count({
      where: { id: itemId, orderId: order.id },
    });

    if (count === 0) {
      throw new Error('Item does not belong to this order');
    }

    await prisma.orderItem.update({
      where: { id: itemId },
      data: { supplierId },
    });
  }

  private async handleTransition(order: Order, userId: string) {
    // Simplified linear transition logic
    let nextStatus: OrderStatus = order.status;

    switch (order.status) {
      case 'RECEIVED':
        nextStatus = 'PROCESSING';
        break;
      case 'PROCESSING':
        nextStatus = 'READY';
        break;
      case 'READY':
        nextStatus = 'IN_TRANSIT';
        break;
      case 'IN_TRANSIT':
        nextStatus = 'INSTALLATION';
        break;
      case 'INSTALLATION':
        nextStatus = 'COMPLETED';
        break;
      default:
        return; // No auto-transition for terminal states
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
      },
    });
  }

  private async blockOrder(
    orderId: string,
    userId: string,
    reason: BlockedReasonCode,
    note?: string
  ) {
    // Create Blocking Task
    await prisma.task.create({
      data: {
        notes: `Resolve Block: ${reason}. ${note || 'Order is blocked and requires attention'}`,
        orderId,
        priority: 'URGENT', // Use string or TaskPriority.URGENT
        status: TaskStatus.OPEN,
        assigneeId: userId,
        type: TaskType.OTHER,
      },
    });
  }

  private async unblockOrder(orderId: string, userId: string, note?: string) {
    // Unblock logic placeholder
  }
}
