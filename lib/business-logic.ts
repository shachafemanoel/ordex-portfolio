/**
 * Business Logic Layer for Order Management System
 * Centralized business rules, validations, and workflows
 */

import { NotFoundError, ValidationError } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { getStatusLabel } from '@/lib/orderStatus';
import { evaluateReceivingProgress } from '@/lib/receiving-evaluator';
import { serializeOrder } from '@/lib/serializers/orderSerializer';
import { DomainError } from '@/lib/server/errors';
import { OrderAutomationService } from '@/lib/services/order-automation';
import { executeGuards, getGuardErrorMessage } from '@/lib/status-guards';
import { validateTransition, type ValidationResult } from '@/lib/status-machine';
import type { Order } from '@/lib/types';
import {
  PurchaseOrderStatus,
  TaskStatus,
  TaskType,
  type OrderStatus,
  type Prisma,
  type StatusHistory,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  getMissingFieldsMessage,
  validateStatusTransitionPrerequisites,
  type OrderForValidation,
} from './order-validations';

/**
 * Validate if a string is a valid UUID
 * @param value - The string to validate
 * @returns True if the string is a valid UUID format
 */
function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// Business Logic Interfaces
export interface OrderStatusChangeRequest {
  orderId: string;
  newStatus: OrderStatus;
  reason?: string;
  userId: string;
  userRole?: string;
  installAt?: Date;
  installerName?: string | null;
  installerNotes?: string | null;
}

export interface OrderStatusChangeResult {
  order: Order;
  historyEntry: StatusHistory;
  triggeredActions: string[];
}

type CreatedPurchaseOrderSummary = {
  id: string;
  reference: string;
  supplierId: string;
  supplierName?: string | null;
};

function buildPurchaseOrderReferenceCandidate(supplierName?: string | null): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const sanitized =
    supplierName
      ?.normalize('NFKD')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 3) || '';

  const supplierPart = sanitized.padEnd(3, 'X');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `PO-${supplierPart}-${datePart}-${randomPart}`;
}

async function generateUniquePurchaseOrderReference(
  tx: Prisma.TransactionClient,
  supplierName?: string | null
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = buildPurchaseOrderReferenceCandidate(supplierName);
    const existing = await tx.purchaseOrder.findFirst({
      where: { reference: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `PO-${randomUUID().split('-')[0].toUpperCase()}`;
}

export interface PurchaseOrderGenerationRequest {
  orderIds: string[];
  userId: string;
  groupBySupplierId?: boolean;
}

export interface InventoryUpdateRequest {
  orderItemId: string;
  receivedQuantity: number;
  userId: string;
}

// Order Status Management Business Logic
export class OrderStatusManager {
  /**
   * Validates if a status transition is allowed using the new status machine
   */
  static validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus
  ): ValidationResult {
    return validateTransition(currentStatus, newStatus);
  }

  /**
   * Validates role-based permissions for status changes with new status values
   */
  static async validateStatusChangePermissions(
    userRole: string,
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
    userId: string,
    order: any
  ): Promise<void> {
    switch (userRole) {
      case 'INSTALLER':
        // Installers can only mark their assigned installations as complete
        if (order.assignedUserId !== userId) {
          throw new DomainError('status_permission_denied', 403, {
            message: 'ההזמנה אינה משויכת למתקין הנוכחי',
            orderId: order.id,
          });
        }
        if (newStatus !== 'COMPLETED' || currentStatus !== 'SCHEDULED') {
          throw new DomainError('status_permission_denied', 403, {
            message: 'מתקין יכול לסמן השלמה רק להזמנות במצב ממתין להתקנה',
            fromStatus: currentStatus,
            toStatus: newStatus,
          });
        }
        break;

      case 'SALES':
        // Sales can create orders and schedule installations
        const salesAllowedTransitions: OrderStatus[] = [
          'TO_DO',
          'CALL_BACK',
          'READY_FOR_INSTALL',
          'SCHEDULED',
        ];
        if (!salesAllowedTransitions.includes(newStatus)) {
          throw new DomainError('status_permission_denied', 403, {
            message: 'סוכן מכירות אינו מורשה לשינוי סטטוס זה',
            toStatus: newStatus,
          });
        }
        break;

      case 'PURCHASING':
        // Purchasing can manage supplier-related statuses
        const purchasingAllowedTransitions: OrderStatus[] = [
          'PO_CREATED',
          'AWAITING_STOCK',
          'PARTIALLY_SUPPLIED',
        ];
        if (!purchasingAllowedTransitions.includes(newStatus)) {
          throw new DomainError('status_permission_denied', 403, {
            message: 'רכש אינו מורשה לשינוי סטטוס זה',
            toStatus: newStatus,
          });
        }
        break;

      case 'ADMIN':
        // Admin can perform any status change (no restrictions)
        break;

      default:
        throw new DomainError('status_permission_denied', 403, {
          message: 'תפקיד משתמש לא מוכר',
          role: userRole,
        });
    }
  }

  /**
   * Changes order status with business logic validation and audit logging
   */
  static async changeOrderStatus({
    orderId,
    newStatus,
    reason,
    userId,
    userRole,
    installAt,
    installerName,
    installerNotes,
  }: OrderStatusChangeRequest): Promise<OrderStatusChangeResult> {
    const result = await prisma.$transaction(async (tx) => {
      // Get current order
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  defaultSupplier: true,
                },
              },
            },
          },
          customer: true,
          shippingAddress: true,
          billingAddress: true,
          assignedUser: true,
        },
      });

      if (!order) {
        throw new NotFoundError('Order');
      }

      const installerNameProvided = installerName !== undefined;
      const installerNotesProvided = installerNotes !== undefined;
      const normalizedInstallerName = installerNameProvided
        ? (installerName?.trim() ?? '')
        : undefined;
      const normalizedInstallerNotes = installerNotesProvided
        ? (installerNotes?.trim() ?? '')
        : undefined;

      // Role-based status change permissions
      if (userRole) {
        await this.validateStatusChangePermissions(
          userRole,
          order.status as OrderStatus,
          newStatus,
          userId,
          order
        );
      }

      // Validate status transition using new status machine
      const validationResult = this.validateStatusTransition(
        order.status as OrderStatus,
        newStatus
      );
      if (!validationResult.isValid) {
        throw new DomainError('invalid_status_transition', 400, {
          message: validationResult.reason || `לא ניתן לעבור מ-${order.status} אל ${newStatus}`,
          fromStatus: order.status,
          toStatus: newStatus,
        });
      }

      // ✅ PHASE 1: Validate prerequisites for target status using new guard system
      const orderForValidation: OrderForValidation = {
        id: order.id,
        status: order.status as OrderStatus,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        addressLine: order.addressLine,
        city: order.city,
        scheduledAt: order.scheduledAt,
        shippingAddress: order.shippingAddress
          ? {
              city: order.shippingAddress.city,
              street: order.shippingAddress.street,
              number: order.shippingAddress.number,
            }
          : null,
        billingAddress: order.billingAddress
          ? {
              city: order.billingAddress.city,
              street: order.billingAddress.street,
              number: order.billingAddress.number,
            }
          : null,
        items: order.items.map((item) => ({
          id: item.id,
          qty: item.qty,
          received: item.received || false,
          allocationStatus: item.allocationStatus,
          name: item.name || item.product?.name,
        })),
        installerName: order.installerName,
        installerNotes: order.installerNotes,
      };

      // Use new guard system for validation
      const guardsExecution = executeGuards(orderForValidation, newStatus, {
        currentStatus: order.status as OrderStatus,
        additionalData: {
          userId,
          userRole,
          installAt,
          reason,
          installerName:
            normalizedInstallerName && normalizedInstallerName.length > 0
              ? normalizedInstallerName
              : undefined,
          installerNotes:
            normalizedInstallerNotes && normalizedInstallerNotes.length > 0
              ? normalizedInstallerNotes
              : undefined,
        },
      });

      if (!guardsExecution.allPassed) {
        const errorMessage = getGuardErrorMessage(guardsExecution);
        throw new DomainError('status_guard_failed', 400, {
          message: errorMessage,
          guard: (guardsExecution.blockingFailures || []).map((g: any) => g.id),
        });
      }

      // Also run legacy validation as fallback
      const prerequisiteValidation = validateStatusTransitionPrerequisites(
        orderForValidation,
        newStatus,
        { installAt }
      );

      if (!prerequisiteValidation.isValid) {
        const errorMessage = getMissingFieldsMessage(prerequisiteValidation);
        throw new DomainError('status_prerequisite_failed', 400, {
          message: errorMessage,
          details: prerequisiteValidation.errors,
        });
      }

      let resolvedStatus = newStatus;

      // Apply business rules based on new status
      const updateData: Prisma.OrderUpdateInput = {
        status: resolvedStatus,
        updatedAt: new Date(),
      };

      if (installerNameProvided) {
        updateData.installerName =
          normalizedInstallerName && normalizedInstallerName.length > 0
            ? normalizedInstallerName
            : null;
      }

      if (installerNotesProvided) {
        updateData.installerNotes =
          normalizedInstallerNotes && normalizedInstallerNotes.length > 0
            ? normalizedInstallerNotes
            : null;
      }

      const triggeredActions: string[] = [];
      const createdPurchaseOrders: CreatedPurchaseOrderSummary[] = [];
      let callbackTaskId: string | undefined;
      let callbackEnqueued = false;

      // Status-specific business logic with new status names
      const existingScheduledAt = order.scheduledAt as Date | null | undefined;

      switch (resolvedStatus) {
        case 'PO_CREATED': {
          const itemsWithoutSupplier = order.items.filter(
            (item) => !item.product?.defaultSupplierId
          );

          if (itemsWithoutSupplier.length > 0) {
            const missingNames = itemsWithoutSupplier
              .map((item) => item.product?.name || item.name || 'Unknown item')
              .join(', ');
            throw new DomainError('purchase_order_missing_supplier', 400, {
              message: `אי אפשר ליצור הזמנת רכש — חסר ספק ברירת מחדל עבור ${missingNames}`,
              items: itemsWithoutSupplier.map((item) => item.id),
            });
          }

          triggeredActions.push('PO_CREATED_ELIGIBLE');

          const itemsBySupplier = new Map<
            string,
            { supplierName?: string | null; items: typeof order.items }
          >();

          for (const item of order.items) {
            const supplierId = item.product?.defaultSupplierId;
            if (!supplierId) continue;

            if (!itemsBySupplier.has(supplierId)) {
              itemsBySupplier.set(supplierId, {
                supplierName: item.product?.defaultSupplier?.name,
                items: [],
              });
            }

            itemsBySupplier.get(supplierId)?.items.push(item);
          }

          if (itemsBySupplier.size > 0) {
            const existingSupplierLinks = await tx.purchaseOrder.findMany({
              where: {
                supplierId: { in: Array.from(itemsBySupplier.keys()) },
                linkedOrderIds: { has: order.id },
                status: { not: PurchaseOrderStatus.CANCELLED },
              },
              select: { supplierId: true },
            });

            const suppliersWithExistingPO = new Set(
              existingSupplierLinks.map((po) => po.supplierId)
            );

            for (const [supplierId, { supplierName, items }] of itemsBySupplier) {
              if (suppliersWithExistingPO.has(supplierId)) {
                continue;
              }

              const aggregatedItems = new Map<string, { productId: string; qty: number }>();

              for (const item of items) {
                const productId = item.product?.id ?? item.productId;
                if (!productId) {
                  throw new DomainError('purchase_order_missing_product', 400, {
                    message: `אי אפשר ליצור הזמנת רכש — לפריט ${item.id} חסרה הפניה למוצר`,
                    orderItemId: item.id,
                  });
                }

                const current = aggregatedItems.get(productId);
                aggregatedItems.set(productId, {
                  productId,
                  qty: (current?.qty ?? 0) + item.qty,
                });
              }

              if (aggregatedItems.size === 0) {
                continue;
              }

              const reference = await generateUniquePurchaseOrderReference(tx, supplierName);
              const po = await tx.purchaseOrder.create({
                data: {
                  reference,
                  supplierId,
                  status: PurchaseOrderStatus.DRAFT,
                  linkedOrderIds: [order.id],
                  items: {
                    create: Array.from(aggregatedItems.values()).map(({ productId, qty }) => ({
                      productId,
                      qtyOrdered: qty,
                    })),
                  },
                },
                include: {
                  supplier: {
                    select: { name: true },
                  },
                },
              });

              createdPurchaseOrders.push({
                id: po.id,
                reference: po.reference,
                supplierId: po.supplierId,
                supplierName: po.supplier?.name ?? supplierName ?? null,
              });
            }

            if (createdPurchaseOrders.length > 0) {
              triggeredActions.push('PO_CREATEDS_AUTO_CREATED');
            } else {
              triggeredActions.push('PO_CREATEDS_ALREADY_LINKED');
            }
          }

          resolvedStatus = 'AWAITING_STOCK';
          updateData.status = resolvedStatus;
          triggeredActions.push('AUTO_AWAITING_STOCK');
          break;
        }

        case 'READY_FOR_INSTALL': {
          // Ensure all items are received before marking as ready
          const unreceivedItems = order.items.filter((item) => !item.received);
          if (unreceivedItems.length > 0) {
            throw new DomainError('status_guard_failed', 400, {
              message: 'לא ניתן לעבור לסטטוס תיאום התקנה לפני שכל הפריטים התקבלו',
              items: unreceivedItems.map((item) => item.id),
            });
          }
          triggeredActions.push('READY_FOR_INSTALLATION');
          break;
        }

        case 'SCHEDULED':
          // Validate all items are received
          const unreceivedItems = order.items.filter((item) => !item.received);
          if (unreceivedItems.length > 0) {
            throw new DomainError('status_guard_failed', 400, {
              message: 'לא ניתן לעבור לסטטוס ממתין להתקנה לפני שכל הפריטים התקבלו',
              items: unreceivedItems.map((item) => item.id),
            });
          }
          // When scheduling, require installation date
          const effectiveInstallDate = installAt || existingScheduledAt;
          if (installAt) {
            updateData.scheduledAt = installAt;
          } else if (!effectiveInstallDate) {
            throw new DomainError('status_prerequisite_failed', 400, {
              message: 'יש לקבוע תאריך התקנה לפני מעבר לסטטוס ממתין להתקנה',
            });
          }

          // Create calendar event if installation date is provided
          if (effectiveInstallDate) {
            try {
              const { createInstallationEvent } = await import('@/lib/calendar');
              await createInstallationEvent({
                id: order.id,
                number: order.number,
                customerName: order.customer?.name ?? 'לקוח ללא שם',
                note:
                  [
                    normalizedInstallerNotes && normalizedInstallerNotes.length > 0
                      ? normalizedInstallerNotes
                      : null,
                    normalizedInstallerName && normalizedInstallerName.length > 0
                      ? `מתקין: ${normalizedInstallerName}`
                      : null,
                    order.notesInternal ?? undefined,
                  ]
                    .filter(Boolean)
                    .join('\n') || undefined,
                address:
                  order.addressLine ??
                  [
                    order.shippingAddress?.street,
                    order.shippingAddress?.number,
                    order.shippingAddress?.city,
                  ]
                    .filter(Boolean)
                    .join(', '),
                city: order.shippingAddress?.city ?? order.city ?? '',
                installAt: effectiveInstallDate,
              });
              triggeredActions.push('CALENDAR_EVENT_CREATED');
            } catch (calendarError) {
              console.warn('Failed to create calendar event:', calendarError);
              // Don't fail the status change if calendar creation fails
            }
          }

          triggeredActions.push('INSTALLATION_SCHEDULED');
          break;

        case 'COMPLETED':
          // Final status - create completion audit
          updateData.completedAt = new Date();

          // Mark related calendar events as completed
          try {
            const calendarEvents = await tx.calendarEvent.findMany({
              where: { orderId: order.id, status: 'SCHEDULED' },
            });

            for (const event of calendarEvents) {
              await tx.calendarEvent.update({
                where: { id: event.id },
                data: { status: 'COMPLETED' },
              });

              // Update Google Calendar if event has googleId
              if (event.googleId) {
                const { updateEventById } = await import('@/lib/calendar');
                try {
                  await updateEventById(event.googleId, {
                    summary: `[COMPLETED] ${event.title}`,
                  });
                } catch (googleError) {
                  console.warn('Failed to update Google Calendar event:', googleError);
                }
              }
            }

            triggeredActions.push('CALENDAR_EVENTS_COMPLETED');
          } catch (calendarError) {
            console.warn('Failed to update calendar events:', calendarError);
          }

          triggeredActions.push('ORDER_COMPLETED');
          break;

        case 'CALL_BACK': {
          triggeredActions.push('CUSTOMER_CALLBACK_REQUIRED');

          const existingCallbackTask = await tx.task.findFirst({
            where: {
              orderId,
              type: TaskType.CALL_BACK,
              status: TaskStatus.OPEN,
            },
            select: { id: true },
          });

          if (!existingCallbackTask) {
            const callbackTask = await tx.task.create({
              data: {
                type: TaskType.CALL_BACK,
                status: TaskStatus.OPEN,
                orderId,
                assigneeId: userId,
                dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                notes: `צור קשר עם ${order.customer?.name ?? 'לקוח ללא שם'}${
                  order.customer?.phone ? ` (${order.customer.phone})` : ''
                }`,
              },
            });

            callbackTaskId = callbackTask.id;
            triggeredActions.push('CALLBACK_TASK_CREATED');

            // ✅ PHASE 2: Callback reminder disabled
            // TODO: Implement new notification system
          }

          if (process.env.REDIS_URL && process.env.TENANT_ENFORCEMENT !== 'true') {
            try {
              const { createClient } = await import('redis');
              const redis = createClient({ url: process.env.REDIS_URL });
              await redis.connect();

              const prefix = process.env.REDIS_PREFIX || 'ordex';
              await redis.lPush(
                `${prefix}:queue:callbacks`,
                JSON.stringify({
                  orderId,
                  customerName: order.customer?.name ?? null,
                  customerPhone: order.customer?.phone ?? null,
                  createdAt: new Date().toISOString(),
                })
              );

              await redis.quit();
              callbackEnqueued = true;
              triggeredActions.push('CALLBACK_ENQUEUED');
            } catch (redisError) {
              console.error('Failed to enqueue callback:', redisError);
            }
          }

          break;
        }
      }

      // Auto-create calendar event when installation date is provided
      if (installAt) {
        // Set scheduled date on order
        updateData.scheduledAt = installAt;

        // Clean up any previous calendar event for this order, then create a fresh one
        await tx.calendarEvent.deleteMany({ where: { orderId } });

        const start = installAt;
        const end = new Date(start.getTime() + 120 * 60 * 1000); // Default 2 hours
        const orderLocation =
          order.addressLine || order.shippingAddress
            ? [order.addressLine, order.shippingAddress?.city].filter(Boolean).join(', ')
            : order.city || null;

        const customerLine = order.customer?.name
          ? `לקוח: ${order.customer.name}${order.customer.phone ? ` (${order.customer.phone})` : ''}`
          : undefined;

        await tx.calendarEvent.create({
          data: {
            orderId,
            title: `התקנה להזמנה #${order.number}`,
            description: [customerLine, reason ? `הערות: ${reason}` : null]
              .filter(Boolean)
              .join('\n'),
            status: 'SCHEDULED',
            location: orderLocation || undefined,
            startTime: start,
            endTime: end,
            createdBy: userId,
            demo: order.demo || false,
          },
        });

        triggeredActions.push('CALENDAR_EVENT_CREATED');
      }

      // Update the order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          items: {
            include: {
              product: {
                include: {
                  defaultSupplier: true,
                },
              },
            },
          },
          customer: true,
          billingAddress: true,
          shippingAddress: true,
          assignedUser: true,
          payments: {
            orderBy: { updatedAt: 'desc' as Prisma.SortOrder },
          },
        },
      });

      // Create status log entry for audit trail
      const statusMetadata: Record<string, unknown> = {
        triggeredActions,
        previousStatus: order.status,
      };

      if (callbackTaskId) {
        statusMetadata.callbackTaskId = callbackTaskId;
      }

      if (callbackEnqueued) {
        statusMetadata.callbackQueued = true;
      }

      if (createdPurchaseOrders.length > 0) {
        statusMetadata.createdPurchaseOrders = createdPurchaseOrders;
      }

      if (installerNameProvided) {
        statusMetadata.installerName =
          normalizedInstallerName && normalizedInstallerName.length > 0
            ? normalizedInstallerName
            : null;
      }

      if (installerNotesProvided) {
        statusMetadata.installerNotes =
          normalizedInstallerNotes && normalizedInstallerNotes.length > 0
            ? normalizedInstallerNotes
            : null;
      }

      // Only set userId if provided identifier is a valid UUID (seeded admin may not be)
      const historyChangedBy = isValidUuid(userId) ? userId : undefined;
      const statusDisplay = getStatusLabel(resolvedStatus);

      const historyEntry = await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: order.status as OrderStatus,
          toStatus: resolvedStatus,
          changedBy: historyChangedBy,
          reason: reason || `הסטטוס עודכן ל-${statusDisplay}`,
          metadata: statusMetadata as Prisma.InputJsonValue,
          demo: order.demo || false,
        },
      });

      const serialized = serializeOrder(updatedOrder as any);

      return {
        order: serialized,
        historyEntry,
        triggeredActions,
        _previousStatus: order.status as OrderStatus,
        resolvedStatus,
      };
    });

    // After transaction completes, trigger automation hooks (async, non-blocking)
    if (result && result._previousStatus !== newStatus) {
      OrderAutomationService.onStatusChange(
        orderId,
        result._previousStatus,
        result.resolvedStatus,
        userId
      ).catch((error) => {
        console.error('[OrderStatusManager] Automation hook failed:', error);
      });
    }

    // Return result without internal _previousStatus field
    const { _previousStatus, resolvedStatus: _resolved, ...publicResult } = result;
    return publicResult;
  }

  /**
   * Get status transition history for an order
   */
  static async getOrderStatusHistory(orderId: string) {
    return await prisma.statusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: {
        changedByUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }
}

// Inventory Management Business Logic
export class InventoryManager {
  /**
   * Update received quantity for order items with stock management
   */
  static async updateReceivedQuantity({
    orderItemId,
    receivedQuantity,
    userId: _userId,
  }: InventoryUpdateRequest) {
    return await prisma.$transaction(async (tx) => {
      // Get order item with related data
      const orderItem = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        include: {
          order: true,
          product: true,
        },
      });

      if (!orderItem) {
        throw new NotFoundError('Order item');
      }

      // Validate received quantity
      if (receivedQuantity < 0) {
        throw new ValidationError('Received quantity cannot be negative');
      }

      if (receivedQuantity > orderItem.qty) {
        throw new ValidationError('Received quantity cannot exceed ordered quantity');
      }

      // Update order item
      const updatedItem = await tx.orderItem.update({
        where: { id: orderItemId },
        data: {
          received: receivedQuantity === orderItem.qty,
          receivedQuantity,
        },
      });

      // Update Product stock if it exists
      if (orderItem.product) {
        await tx.product.update({
          where: { id: orderItem.product.id },
          data: {
            stock: {
              increment: receivedQuantity,
            },
          },
        });
      }

      // Check if all items in the order are received
      const allOrderItems = await tx.orderItem.findMany({
        where: { orderId: orderItem.orderId },
      });

      const evaluation = evaluateReceivingProgress(
        allOrderItems,
        (orderItem as any).order.status as OrderStatus
      );
      if (evaluation.newStatus) {
        await tx.order.update({
          where: { id: orderItem.orderId },
          data: { status: evaluation.newStatus },
        });
      }

      return updatedItem;
    });
  }

  /**
   * Check stock availability for order items
   */
  static async checkStockAvailability(orderItems: { productId: string; qty: number }[]) {
    const stockChecks = await Promise.all(
      orderItems.map(async (item) => {
        if (!item.productId) return { productId: item.productId, available: true, currentStock: 0 };

        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        return {
          productId: item.productId,
          available: product ? product.stock >= item.qty : false,
          currentStock: product?.stock || 0,
          requested: item.qty,
        };
      })
    );

    return {
      allAvailable: stockChecks.every((check) => check.available),
      checks: stockChecks,
    };
  }
}

// Purchase Order Generation Business Logic (Enhanced)
export class PurchaseOrderManager {
  /**
   * Calculate shortage for a specific SKU considering current stock and pending POs
   */
  static async calculateSkuShortage(
    productId: string,
    supplierId?: string
  ): Promise<{
    productId: string;
    currentStock: number;
    totalOrdered: number;
    pendingOrders: number;
    shortageQuantity: number;
  }> {
    const result = await prisma.$queryRaw<
      Array<{
        sku_id: string;
        current_stock: number;
        total_ordered: number;
        pending_orders: number;
        shortage_quantity: number;
      }>
    >`
      SELECT * FROM calculate_sku_shortage(${productId}, ${supplierId || null})
    `;

    if (result.length === 0) {
      throw new NotFoundError('SKU not found');
    }

    const shortage = result[0];
    return {
      productId: shortage.sku_id,
      currentStock: shortage.current_stock,
      totalOrdered: shortage.total_ordered,
      pendingOrders: shortage.pending_orders,
      shortageQuantity: shortage.shortage_quantity,
    };
  }

  /**
   * Get comprehensive supplier demand analysis
   */
  static async getSupplierDemandAnalysis(orderIds?: string[]): Promise<
    Array<{
      supplierId: string;
      supplierName: string;
      totalDemand: number;
      totalValue: number;
      itemsWithShortage: number;
      averageShortage: number;
    }>
  > {
    const whereCondition =
      orderIds && orderIds.length > 0 ? `AND o.id = ANY(${JSON.stringify(orderIds)}::text[])` : '';

    return await prisma.$queryRaw`
      WITH supplier_demand AS (
        SELECT 
          s.id as supplier_id,
          s.name as supplier_name,
          COUNT(DISTINCT oi.product_id) as unique_products,
          SUM(oi.qty) as total_demand,
          SUM(oi.qty * COALESCE(sk.base_price_cents, 0)) as total_value
        FROM suppliers s
        JOIN products sk ON s.id = sk.default_supplier_id
        JOIN order_items oi ON sk.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'PO_CREATED'
          AND NOT oi.received
          ${whereCondition}
        GROUP BY s.id, s.name
      ),
      shortage_analysis AS (
        SELECT 
          supplier_id,
          COUNT(CASE WHEN shortage_quantity > 0 THEN 1 END) as items_with_shortage,
          AVG(CASE WHEN shortage_quantity > 0 THEN shortage_quantity ELSE 0 END) as avg_shortage
        FROM (
          SELECT DISTINCT
            s.id as supplier_id,
            calculate_sku_shortage.shortage_quantity
          FROM suppliers s
          JOIN products sk ON s.id = sk.default_supplier_id
          JOIN order_items oi ON sk.id = oi.product_id
          JOIN orders o ON oi.order_id = o.id
          CROSS JOIN LATERAL calculate_sku_shortage(sk.id, s.id)
          WHERE o.status = 'PO_CREATED'
            AND NOT oi.received
            ${whereCondition}
        ) shortage_data
        GROUP BY supplier_id
      )
      SELECT 
        sd.supplier_id::text,
        sd.supplier_name,
        sd.total_demand::integer,
        sd.total_value::numeric,
        COALESCE(sa.items_with_shortage, 0)::integer,
        COALESCE(sa.avg_shortage, 0)::numeric
      FROM supplier_demand sd
      LEFT JOIN shortage_analysis sa ON sd.supplier_id = sa.supplier_id
      ORDER BY sd.total_value DESC
    `;
  }

  /**
   * Generate purchase orders with enhanced shortage calculation logic
   * @deprecated Use PurchaseOrderService.generatePurchaseOrders instead
   */
  static async generatePurchaseOrders({
    orderIds,
    userId: _userId,
    groupBySupplierId: _groupBySupplierId = true,
  }: PurchaseOrderGenerationRequest) {
    // This method is deprecated - redirect to the new service
    const { PurchaseOrderService } = await import('@/lib/purchase-orders');

    return await PurchaseOrderService.generatePurchaseOrders({
      orderIds,
      userId: _userId,
      userRole: undefined, // Will be handled by the service
    });
  }

  /**
   * Update purchase order status with enhanced business logic
   * @deprecated Use PurchaseOrderService.updatePurchaseOrderStatus instead
   */
  static async updatePurchaseOrderStatus(
    purchaseOrderId: string,
    status: 'OPEN' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED',
    userId: string
  ) {
    // This method is deprecated - redirect to the new service
    const { PurchaseOrderService } = await import('@/lib/purchase-orders');

    return await PurchaseOrderService.updatePurchaseOrderStatus(purchaseOrderId, status, userId);
  }

  /**
   * Get low stock alerts based on reorder levels
   */
  static async getLowStockAlerts(): Promise<
    Array<{
      productId: string;
      skuCode: string;
      skuName: string;
      currentStock: number;
      reorderLevel: number;
      supplierName: string;
      shortageQuantity: number;
    }>
  > {
    return await prisma.$queryRaw`
      SELECT 
        p.id::text as sku_id,
        p.sku as sku_code,
        p.name as sku_name,
        p.stock::integer as current_stock,
        p.reorder_level::integer as reorder_level,
        sup.name as supplier_name,
        GREATEST(0, p.reorder_level - p.stock)::integer as shortage_quantity
      FROM products p
      LEFT JOIN suppliers sup ON p.default_supplier_id = sup.id
      WHERE p.stock <= p.reorder_level
        AND p.is_active = true
        AND p.reorder_level > 0
      ORDER BY (p.reorder_level - p.stock) DESC, p.name ASC
    `;
  }

  /**
   * Update reorder levels for SKUs based on historical demand
   */
  static async updateReorderLevels(productIds?: string[]): Promise<void> {
    const whereCondition =
      productIds && productIds.length > 0
        ? `AND s.id = ANY(${JSON.stringify(productIds)}::text[])`
        : '';

    await prisma.$executeRaw`
      UPDATE products 
      SET reorder_level = GREATEST(
        reorder_level,
        COALESCE(historical_demand.avg_monthly_demand * 1.5, reorder_level)
      )
      FROM (
        SELECT 
          oi.product_id,
          AVG(monthly_demand) as avg_monthly_demand
        FROM (
          SELECT 
            oi.product_id,
            DATE_TRUNC('month', o.created_at) as month,
            SUM(oi.qty) as monthly_demand
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE o.created_at >= NOW() - INTERVAL '6 months'
          GROUP BY oi.product_id, DATE_TRUNC('month', o.created_at)
        ) monthly_data
        GROUP BY product_id
      ) historical_demand
      WHERE products.id = historical_demand.product_id
        ${whereCondition}
    `;
  }
}

// Order Creation Business Logic
export class OrderManager {
  /**
   * Create order with business validation
   */
  static async createOrder(orderData: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    totalAmount: number;
    address: string;
    city?: string;
    note?: string;
    items: { productId?: string; qty: number }[];
    userId?: string;
    clientId?: string;
  }) {
    return await prisma.$transaction(async (tx) => {
      // Note: Order number is now generated automatically by PostgreSQL sequence
      // The 'number' field in the schema uses DEFAULT nextval('order_number_seq')
      // This completely eliminates race conditions

      // Validate stock availability
      const stockCheck = await InventoryManager.checkStockAvailability(
        orderData.items.filter(
          (item): item is typeof item & { productId: string } => !!item.productId
        )
      );

      // Create the order with explicit number from DB sequence
      const next = await tx.$queryRaw<
        { number: number }[]
      >`SELECT nextval('order_number_seq')::int as number`;
      const nextNumber = Array.isArray(next) && next[0]?.number ? next[0].number : Date.now();
      // 1. Resolve or Create Customer
      let customerId: string;
      if (orderData.clientId) {
        customerId = orderData.clientId;
      } else {
        const newCustomer = await tx.customer.create({
          data: {
            name: orderData.customerName,
            email: orderData.customerEmail,
            phone: orderData.customerPhone,
          },
        });
        customerId = newCustomer.id;
      }

      // 2. Create Addresses
      const billingAddress = await tx.address.create({
        data: {
          type: 'BILLING',
          street: orderData.address,
          city: orderData.city || 'Unknown',
          number: '0',
          customer: { connect: { id: customerId } },
        },
      });

      const shippingAddress = await tx.address.create({
        data: {
          type: 'SHIPPING',
          street: orderData.address,
          city: orderData.city || 'Unknown',
          number: '0',
          customer: { connect: { id: customerId } },
        },
      });

      // 3. Create the order
      const order = await tx.order.create({
        data: {
          number: String(nextNumber),
          customerName: orderData.customerName,
          customerEmail: orderData.customerEmail,
          customerPhone: orderData.customerPhone,
          totalCents: orderData.totalAmount,
          addressLine: orderData.address,
          city: orderData.city,
          currency: 'ILS',
          status: 'TO_DO',
          channel: 'MANUAL',
          ...(orderData.userId ? { assignedUser: { connect: { id: orderData.userId } } } : {}),
          customer: { connect: { id: customerId } },
          billingAddress: { connect: { id: billingAddress.id } },
          shippingAddress: { connect: { id: shippingAddress.id } },
          items: {
            create: await Promise.all(
              orderData.items.map(async (item) => {
                const product = item.productId
                  ? await tx.product.findUnique({ where: { id: item.productId } })
                  : null;
                return {
                  productId: item.productId as string,
                  qty: item.qty,
                  received: false,
                  sku: product?.sku || 'UNKNOWN',
                  name: product?.name || 'Unknown item',
                  priceCents: product?.basePriceCents || 0,
                  totalCents: (product?.basePriceCents || 0) * item.qty,
                  vatCategory: 'STANDARD' as const,
                };
              })
            ),
          },
        },
        include: {
          items: {
            include: { product: { include: { defaultSupplier: true } } },
          },
          customer: true,
          assignedUser: true,
        },
      });

      return {
        order,
        stockWarnings: stockCheck.allAvailable ? [] : stockCheck.checks.filter((c) => !c.available),
      };
    });
  }

  /**
   * Map WooCommerce order status to our internal OrderStatus
   */
  private static mapWooCommerceStatus(wooStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      pending: 'TO_DO',
      processing: 'TO_DO',
      'on-hold': 'CALL_BACK',
      completed: 'SUPPLIED',
      cancelled: 'CANCELLED',
      refunded: 'CANCELLED',
      failed: 'TO_DO',
    };

    return statusMap[wooStatus] || 'TO_DO';
  }

  /**
   * Create or update order from WooCommerce webhook data
   */
  static async createOrUpdateOrderFromWooCommerce(wooOrderData: any) {
    return await prisma.$transaction(async (tx) => {
      // Check if order already exists by WooCommerce ID
      const existingOrder = await tx.order.findFirst({
        where: { wooOrderId: wooOrderData.id },
        include: { items: true },
      });

      // Transform WooCommerce data to our format
      const orderData = {
        wooOrderId: wooOrderData.id,
        number: parseInt(wooOrderData.number) || wooOrderData.id,
        customerName:
          `${wooOrderData.billing?.first_name || ''} ${wooOrderData.billing?.last_name || ''}`.trim() ||
          wooOrderData.billing?.company ||
          'WooCommerce Customer',
        customerEmail: wooOrderData.billing?.email || wooOrderData.customer_email,
        customerPhone: wooOrderData.billing?.phone || wooOrderData.customer_phone,
        totalCents: Math.round((parseFloat(wooOrderData.total) || 0) * 100),
        address: [
          wooOrderData.shipping?.address_1 || wooOrderData.billing?.address_1,
          wooOrderData.shipping?.address_2 || wooOrderData.billing?.address_2,
        ]
          .filter(Boolean)
          .join(', '),
        city: wooOrderData.shipping?.city || wooOrderData.billing?.city,
        note: wooOrderData.customer_note || `WooCommerce Order #${wooOrderData.number}`,
        status: OrderManager.mapWooCommerceStatus(wooOrderData.status),
        channel: 'WOOCOMMERCE' as const,
        createdAt: wooOrderData.date_created ? new Date(wooOrderData.date_created) : new Date(),
        updatedAt: wooOrderData.date_modified ? new Date(wooOrderData.date_modified) : new Date(),
      };

      if (existingOrder) {
        // Update existing order
        const updatedOrder = await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            customerName: orderData.customerName,
            customerEmail: orderData.customerEmail,
            customerPhone: orderData.customerPhone,
            totalCents: orderData.totalCents,
            addressLine: orderData.address,
            city: orderData.city,
            notes: orderData.note,
            status: orderData.status,
            updatedAt: orderData.updatedAt,
          },
          include: {
            items: {
              include: { product: { include: { defaultSupplier: true } } },
            },
            customer: true,
            assignedUser: true,
          },
        });

        // TODO: Update order items if needed
        // For now, we'll keep existing items to avoid complexity

        return {
          order: updatedOrder,
          isNew: false,
          stockWarnings: [],
        };
      } else {
        // Create new order
        const lineItems = wooOrderData.line_items || [];

        // 1. Collect all SKUs to look up
        const skusToLookup = new Set<string>();
        lineItems.forEach((item: any) => {
          if (item.sku) skusToLookup.add(item.sku);
          if (item.product_id) skusToLookup.add(`WOO-${item.product_id}`);
        });

        const skuList = Array.from(skusToLookup);
        const productMap = new Map<string, string>(); // SKU -> ProductID

        if (skuList.length > 0) {
          const existingProducts = await tx.product.findMany({
            where: { sku: { in: skuList } },
            select: { id: true, sku: true },
          });
          existingProducts.forEach((p) => productMap.set(p.sku, p.id));
        }

        // 2. Resolve Product IDs, creating missing products on the fly
        const itemProductIds = new Map<number, string>(); // index -> productId

        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          const primarySku = item.sku;
          const fallbackSku = `WOO-${item.product_id}`;

          let productId: string | undefined;

          // Try to find existing
          if (primarySku && productMap.has(primarySku)) {
            productId = productMap.get(primarySku);
          } else if (productMap.has(fallbackSku)) {
            productId = productMap.get(fallbackSku);
          }

          // If not found, create new product
          if (!productId) {
            const skuToCreate = primarySku || fallbackSku;

            // Check if we already created it in this loop (for another item with same SKU)
            if (productMap.has(skuToCreate)) {
              productId = productMap.get(skuToCreate);
            } else {
              // Create new product
              const newProduct = await tx.product.create({
                data: {
                  name: item.name || 'WooCommerce Product',
                  sku: skuToCreate,
                  stock: 0,
                  isActive: true,
                  basePriceCents: Math.round((parseFloat(item.price) || 0) * 100),
                },
                select: { id: true },
              });

              productId = newProduct.id;
              productMap.set(skuToCreate, productId);
            }
          }

          if (productId) {
            itemProductIds.set(i, productId);
          }
        }

        // 1. Resolve or Create Customer
        let customerId: string;
        const existingCustomer = orderData.customerEmail
          ? await tx.customer.findFirst({
              where: { email: orderData.customerEmail },
            })
          : null;

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const newCustomer = await tx.customer.create({
            data: {
              name: orderData.customerName,
              email: orderData.customerEmail,
              phone: orderData.customerPhone,
            },
          });
          customerId = newCustomer.id;
        }

        // 2. Create Addresses
        const billingAddress = await tx.address.create({
          data: {
            type: 'BILLING',
            street: orderData.address || 'WooCommerce Billing',
            city: orderData.city || 'Unknown',
            number: '0',
            customer: { connect: { id: customerId } },
          },
        });

        const shippingAddress = await tx.address.create({
          data: {
            type: 'SHIPPING',
            street: orderData.address || 'WooCommerce Shipping',
            city: orderData.city || 'Unknown',
            number: '0',
            customer: { connect: { id: customerId } },
          },
        });

        const order = await tx.order.create({
          data: {
            wooOrderId: String(orderData.wooOrderId),
            number: String(orderData.number),
            customerName: orderData.customerName,
            customerEmail: orderData.customerEmail,
            customerPhone: orderData.customerPhone,
            totalCents: orderData.totalCents,
            addressLine: orderData.address,
            city: orderData.city,
            currency: 'ILS', // Default currency
            status: orderData.status,
            channel: 'WOOCOMMERCE',
            customer: { connect: { id: customerId } },
            billingAddress: { connect: { id: billingAddress.id } },
            shippingAddress: { connect: { id: shippingAddress.id } },
            items: {
              create: lineItems.map((lineItem: any, index: number) => ({
                productId: itemProductIds.get(index)!,
                qty: parseInt(lineItem.quantity) || 1,
                name: lineItem.name || 'WooCommerce Item',
                sku: lineItem.sku || 'WOO-' + lineItem.product_id,
                priceCents: Math.round((parseFloat(lineItem.price) || 0) * 100),
                totalCents: Math.round((parseFloat(lineItem.total) || 0) * 100),
                vatCategory: 'STANDARD' as const,
                received: false,
                wooProductId: lineItem.product_id ? String(lineItem.product_id) : null,
                wooVariationId: lineItem.variation_id ? String(lineItem.variation_id) : null,
              })),
            },
          },
          include: {
            items: {
              include: { product: { include: { defaultSupplier: true } } },
            },
            customer: true,
            assignedUser: true,
          },
        });

        return {
          order,
          isNew: true,
          stockWarnings: [],
        };
      }
    });
  }

  /**
   * Delete order by WooCommerce ID (for webhook deletion events)
   */
  static async deleteOrderByWooCommerceId(wooOrderId: number) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { wooOrderId: String(wooOrderId) },
      });

      if (!order) {
        console.log(`WooCommerce order ID ${wooOrderId} not found for deletion`);
        return null;
      }

      // Delete related records first (in dependency order)
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.statusHistory.deleteMany({ where: { orderId: order.id } });
      await tx.calendarEvent.deleteMany({ where: { orderId: order.id } });
      await tx.reminder.deleteMany({ where: { orderId: order.id } });

      // Delete the order
      const deletedOrder = await tx.order.delete({
        where: { id: order.id },
      });

      console.log(`Deleted WooCommerce order #${order.number} (ID: ${order.id}) from system`);
      return {
        deletedOrder,
        deletedItems: ['orderItems', 'statusHistory', 'calendarEvents', 'reminders'],
      };
    });
  }

  /**
   * Get order with related data and access control
   */
  static async getOrderById(orderId: string, user: { id: string; role: string }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: { defaultSupplier: true },
            },
          },
        },
        customer: true,
        assignedUser: true,
        calendarEvents: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Order');
    }

    // Role-based access control
    if (user.role === 'INSTALLER') {
      // Installers can only see orders assigned to them
      if (order.assignedUserId !== user.id) {
        throw new ValidationError('Access denied: Order not assigned to you');
      }
    }

    // Additional RBAC checks
    if (user.role === 'SALES') {
      // Sales can only see orders they created or orders without assigned user
      if (order.assignedUserId && order.assignedUserId !== user.id) {
        throw new ValidationError('Access denied: Order not accessible to your role');
      }
    }

    return {
      ...order,
      client: order.customer,
      user: order.assignedUser,
    };
  }
}

// Business Analytics
export class BusinessAnalytics {
  /**
   * Get order statistics by status
   */
  static async getOrderStatusStats() {
    const stats = await prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { totalCents: true },
    });

    return stats.map((stat) => ({
      status: stat.status,
      count: stat._count.id,
      totalValue: (stat._sum.totalCents || 0) / 100,
    }));
  }

  /**
   * Get supplier performance metrics
   */
  static async getSupplierPerformanceMetrics() {
    return await prisma.supplier.findMany({
      include: {
        purchaseOrders: {
          select: {
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            products: true,
            purchaseOrders: true,
          },
        },
      },
    });
  }

  /**
   * Get installation pipeline
   */
  static async getInstallationPipeline() {
    return await prisma.order.findMany({
      where: {
        status: {
          in: ['INSTALL_SCHEDULING', 'AWAITING_INSTALL'],
        },
      },
      include: {
        customer: true,
        calendarEvents: {
          where: { status: 'SCHEDULED' },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
