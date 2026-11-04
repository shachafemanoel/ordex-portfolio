/**
 * Audit Logging Utilities
 *
 * Provides comprehensive audit trail for critical operations.
 * Records who did what, when, and what changed.
 *
 * Features:
 * - Automatic before/after snapshot
 * - Actor tracking (user ID)
 * - Entity tracking
 * - Async/non-blocking logging
 * - Bulk operations support
 *
 * Critical operations to audit:
 * - Order status changes
 * - Order creation/updates/deletion
 * - User creation/updates/deletion
 * - Purchase order approvals
 * - Goods receipt confirmation
 * - Payment recording
 * - Customer data changes
 */

import { logger } from '@/lib/logger';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'RESTORE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PERMISSION_CHANGE';

export type AuditEntity =
  | 'Order'
  | 'Customer'
  | 'User'
  | 'PurchaseOrder'
  | 'GoodsReceipt'
  | 'Payment'
  | 'Supplier'
  | 'Product'
  | 'CalendarEvent'
  | 'MessageLog'
  | 'Template';

export interface AuditEntry {
  actorId?: string;
  action: AuditAction | string;
  entity: AuditEntity | string;
  entityId: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  metadata?: Record<string, any>;
}

/**
 * Log an audit entry
 *
 * @param entry Audit entry data
 * @returns Promise that resolves when entry is logged (non-blocking)
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    // Generic AuditLog table has been removed. Logging to console/file instead.
    logger.info('[AUDIT]', {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before,
      after: entry.after,
    });
    // await prisma.auditLog.create({ ... });

    logger.info('Audit log created', {
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      actorId: entry.actorId,
    });
  } catch (error) {
    // Don't fail the operation if audit logging fails
    logger.error('Failed to create audit log', {
      entry,
      error,
    });
  }
}

/**
 * Log an audit entry asynchronously (fire-and-forget)
 *
 * Useful when you don't want to wait for the audit log to be written.
 * The operation won't fail if audit logging fails.
 *
 * @param entry Audit entry data
 */
export function logAuditAsync(entry: AuditEntry): void {
  // Fire and forget - don't await
  logAudit(entry).catch((error) => {
    logger.error('Async audit logging failed', { entry, error });
  });
}

/**
 * Log bulk audit entries
 *
 * @param entries Array of audit entries
 */
export async function logAuditBulk(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;

  try {
    // Generic AuditLog table has been removed.
    entries.forEach((entry) => {
      logger.info('[AUDIT BULK]', {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
      });
    });
    // await prisma.auditLog.createMany({ ... });

    logger.info('Bulk audit logs created', { count: entries.length });
  } catch (error) {
    logger.error('Failed to create bulk audit logs', { count: entries.length, error });
  }
}

/**
 * Audit decorator for order status changes
 *
 * Usage:
 * ```typescript
 * await auditOrderStatusChange({
 *   orderId: order.id,
 *   fromStatus: order.status,
 *   toStatus: newStatus,
 *   actorId: userId,
 * });
 * ```
 */
export async function auditOrderStatusChange(params: {
  orderId: string;
  fromStatus: string;
  toStatus: string;
  actorId?: string;
  reason?: string;
}): Promise<void> {
  return logAudit({
    actorId: params.actorId,
    action: 'STATUS_CHANGE',
    entity: 'Order',
    entityId: params.orderId,
    before: { status: params.fromStatus },
    after: { status: params.toStatus, reason: params.reason },
  });
}

/**
 * Audit decorator for entity creation
 *
 * Usage:
 * ```typescript
 * await auditCreate({
 *   entity: 'Order',
 *   entityId: newOrder.id,
 *   actorId: userId,
 *   data: newOrder,
 * });
 * ```
 */
export async function auditCreate(params: {
  entity: AuditEntity | string;
  entityId: string;
  actorId?: string;
  data?: Record<string, any>;
}): Promise<void> {
  return logAudit({
    actorId: params.actorId,
    action: 'CREATE',
    entity: params.entity,
    entityId: params.entityId,
    before: null,
    after: params.data || null,
  });
}

/**
 * Audit decorator for entity updates
 *
 * Usage:
 * ```typescript
 * await auditUpdate({
 *   entity: 'Order',
 *   entityId: order.id,
 *   actorId: userId,
 *   before: oldOrder,
 *   after: updatedOrder,
 * });
 * ```
 */
export async function auditUpdate(params: {
  entity: AuditEntity | string;
  entityId: string;
  actorId?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
}): Promise<void> {
  return logAudit({
    actorId: params.actorId,
    action: 'UPDATE',
    entity: params.entity,
    entityId: params.entityId,
    before: params.before || null,
    after: params.after || null,
  });
}

/**
 * Audit decorator for entity deletion
 *
 * Usage:
 * ```typescript
 * await auditDelete({
 *   entity: 'Order',
 *   entityId: order.id,
 *   actorId: userId,
 *   data: order,
 * });
 * ```
 */
export async function auditDelete(params: {
  entity: AuditEntity | string;
  entityId: string;
  actorId?: string;
  data?: Record<string, any>;
}): Promise<void> {
  return logAudit({
    actorId: params.actorId,
    action: 'DELETE',
    entity: params.entity,
    entityId: params.entityId,
    before: params.data || null,
    after: null,
  });
}

/**
 * Retrieve audit trail for an entity
 *
 * @param entity Entity type
 * @param entityId Entity ID
 * @param limit Maximum number of entries to return
 * @returns Array of audit log entries, newest first
 */
export async function getAuditTrail(
  entity: AuditEntity | string,
  entityId: string,
  limit = 100
): Promise<
  Array<{
    id: string;
    actorId: string | null;
    action: string;
    before: any;
    after: any;
    createdAt: Date;
  }>
> {
  // Generic AuditLog table has been removed.
  return [];
  /*
  const entries = await prisma.auditLog.findMany({
    where: {
      entity,
      entityId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
  */

  return [];
}

/**
 * Retrieve audit trail for an actor (user)
 *
 * @param actorId User ID
 * @param limit Maximum number of entries to return
 * @returns Array of audit log entries, newest first
 */
export async function getActorAuditTrail(
  actorId: string,
  limit = 100
): Promise<
  Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string;
    before: any;
    after: any;
    createdAt: Date;
  }>
> {
  // Generic AuditLog table has been removed.
  return [];
  /*
  const entries = await prisma.auditLog.findMany({
    where: {
      actorId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
  */

  return [];
}

/**
 * Get audit statistics
 *
 * @param startDate Start date for stats (defaults to 30 days ago)
 * @param endDate End date for stats (defaults to now)
 * @returns Audit statistics
 */
export async function getAuditStats(
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalEntries: number;
  byAction: Record<string, number>;
  byEntity: Record<string, number>;
  byActor: Record<string, number>;
}> {
  const where = {
    createdAt: {
      gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      lte: endDate || new Date(),
    },
  };

  // Generic AuditLog table has been removed.
  return {
    totalEntries: 0,
    byAction: {},
    byEntity: {},
    byActor: {},
  };
  /*
  const [totalEntries, byAction, byEntity, byActor] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
    }),
    prisma.auditLog.groupBy({
      by: ['entity'],
      where,
      _count: true,
    }),
    prisma.auditLog.groupBy({
      by: ['actorId'],
      where: { ...where, actorId: { not: null } },
      _count: true,
    }),
  ]);
  */

  /*
  return {
    totalEntries,
    byAction: Object.fromEntries(byAction.map((item) => [item.action, item._count])),
    byEntity: Object.fromEntries(byEntity.map((item) => [item.entity, item._count])),
    byActor: Object.fromEntries(byActor.map((item) => [item.actorId || 'unknown', item._count])),
  };
  */
}

/**
 * Clean up old audit logs
 *
 * @param retentionDays Number of days to retain audit logs (defaults to 365)
 * @returns Number of deleted entries
 */
export async function cleanupOldAuditLogs(retentionDays = 365): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    // Generic AuditLog table has been removed.
    return 0;
    /*
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
    */

    logger.info('Cleaned up old audit logs (STUBBED)', { count: 0, retentionDays });
    return 0;
  } catch (error) {
    logger.error('Failed to cleanup old audit logs', { error, retentionDays });
    return 0;
  }
}
