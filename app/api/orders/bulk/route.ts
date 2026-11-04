import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getWooCommerceClient } from '@/lib/woocommerce';

export const dynamic = 'force-dynamic';

// Bulk action schema validation
const ordersBulkActionSchema = z.object({
  orderIds: z.array(z.string()).min(1, 'At least one order ID required'),
  action: z.enum(['updateStatus', 'schedule', 'export', 'delete']),
  data: z
    .object({
      // For status updates
      status: z.string().optional(), // Changed from businessStatus - uses standard Order.status

      // For scheduling
      scheduledDate: z.string().datetime().optional(),
      installerId: z.string().optional(),

      // For export
      format: z.enum(['csv', 'pdf', 'excel']).optional(),

      // Additional context
      notes: z.string().optional(),
      notifyCustomers: z.boolean().optional(),
    })
    .optional(),
});

interface BulkActionResult {
  success: boolean;
  updated: number;
  failed: number;
  errors: Array<{ orderId: string; error: string }>;
  results?: any[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    // Validate request
    const validationResult = ordersBulkActionSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn('Invalid bulk action request', {
        errors: validationResult.error.errors,
        body,
      });

      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validationResult.error.errors,
          },
        },
        { status: 400 }
      );
    }

    const { orderIds, action, data } = validationResult.data;

    logger.info('Processing bulk action', {
      action,
      orderCount: orderIds.length,
      data,
    });

    let result: BulkActionResult;

    switch (action) {
      case 'updateStatus':
        result = await handleBulkStatusUpdate(orderIds, data);
        break;

      case 'schedule':
        result = await handleBulkScheduling(orderIds, data);
        break;

      case 'export':
        result = await handleBulkExport(orderIds, data);
        break;

      case 'delete':
        result = await handleBulkDelete(orderIds);
        break;

      default:
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'INVALID_ACTION',
              message: `Unsupported action: ${action}`,
            },
          },
          { status: 400 }
        );
    }

    logger.info('Bulk action completed', {
      action,
      ...result,
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    logger.error('Bulk action failed', error as Error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Bulk action failed',
        },
      },
      { status: 500 }
    );
  }
}

async function handleBulkStatusUpdate(orderIds: string[], data: any): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!data?.status) {
    throw new Error('Status is required for status updates');
  }

  for (const orderId of orderIds) {
    try {
      // Get order by ID (could be wooOrderId or internal ID)
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: orderId },
            { wooOrderId: orderId }, // wooOrderId is String in schema
          ],
        },
      });

      if (!order) {
        result.errors.push({
          orderId,
          error: 'Order not found',
        });
        result.failed++;
        continue;
      }

      // Update order status
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: data.status as any, // Using current status field
          updatedAt: new Date(),
        },
      });

      // Log status change
      await prisma.statusHistory.create({
        data: {
          orderId: order.id, // Changed from wooOrderId
          fromStatus: order.status,
          toStatus: data.status as any,
          changedBy: null,
          reason: data.notes || 'Bulk status update',
          metadata: {
            triggeredBy: 'bulk_action',
            propagateToWoo: !!data.propagateToWoo,
          },
        },
      });

      // Optionally propagate to WooCommerce
      if (data.propagateToWoo && order.wooOrderId) {
        try {
          const wooClient = getWooCommerceClient();
          if (wooClient) {
            // wooOrderId is string, need to parse to number for WooCommerce API
            const wooId = parseInt(order.wooOrderId);
            if (!isNaN(wooId)) {
              await wooClient.updateOrderStatus(wooId, data.status);
            }
          }
        } catch (wooError) {
          logger.warn('Failed to propagate status to WooCommerce', {
            orderId: order.id,
            wooOrderId: order.wooOrderId,
            error: wooError,
          });
        }
      }

      result.updated++;
    } catch (error) {
      result.errors.push({
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.failed++;
    }
  }

  return result;
}

async function handleBulkScheduling(orderIds: string[], data: any): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!data?.scheduledDate) {
    throw new Error('Scheduled date is required for scheduling');
  }

  const scheduledDate = new Date(data.scheduledDate);

  for (const orderId of orderIds) {
    try {
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: orderId },
            { wooOrderId: orderId }, // wooOrderId is String
          ],
        },
      });

      if (!order) {
        result.errors.push({
          orderId,
          error: 'Order not found',
        });
        result.failed++;
        continue;
      }

      // Create calendar event for installation scheduling
      // Note: 'installation' model doesn't exist - using CalendarEvent instead
      await prisma.calendarEvent.create({
        data: {
          orderId: order.id,
          title: `Installation for Order ${order.number}`,
          startTime: scheduledDate,
          endTime: new Date(scheduledDate.getTime() + 2 * 60 * 60 * 1000), // 2 hours default
          status: 'SCHEDULED',
          assignedTo: data.installerId,
          description: data.notes,
        },
      });

      result.updated++;
    } catch (error) {
      result.errors.push({
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.failed++;
    }
  }

  return result;
}

async function handleBulkExport(orderIds: string[], _data: any): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    updated: orderIds.length,
    failed: 0,
    errors: [],
    results: [],
  };

  // Get orders data for export
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { id: { in: orderIds } },
        { wooOrderId: { in: orderIds } }, // wooOrderId is String
      ],
    },
    include: {
      calendarEvents: true, // Changed from installations
      statusHistory: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  // Format data for export
  const exportData = orders.map((order) => ({
    id: order.id,
    wooOrderId: order.wooOrderId,
    status: order.status, // Changed from businessStatus
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    lat: order.lat?.toString(),
    lng: order.lng?.toString(),
    hasScheduledEvent: order.calendarEvents.length > 0, // Changed from hasInstallation
    lastStatusChange: order.statusHistory[0]?.createdAt, // Changed from businessStatusHistory
  }));

  result.results = exportData;

  return result;
}

async function handleBulkDelete(orderIds: string[]): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const orderId of orderIds) {
    try {
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: orderId },
            { wooOrderId: orderId }, // wooOrderId is String
          ],
        },
      });

      if (!order) {
        result.errors.push({
          orderId,
          error: 'Order not found',
        });
        result.failed++;
        continue;
      }

      // Soft delete: Update deletedAt and cancel events
      await prisma.$transaction(async (tx) => Promise.all([
        // Cancel calendar events instead of deleting
        tx.calendarEvent.updateMany({
          where: { orderId: order.id },
          data: { status: 'CANCELLED' },
        }),
        // Delete reminders (optional, but usually safe to remove future reminders for deleted orders)
        tx.reminder.deleteMany({
          where: { orderId: order.id },
        }),
        // Perform Soft Delete on Order
        tx.order.update({
          where: { id: order.id },
          data: {
            deletedAt: new Date(),
            status: 'CANCELLED' as any, // Optional: ensure status reflects deletion
          },
        }),
      ]));

      result.updated++;
    } catch (error) {
      result.errors.push({
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.failed++;
    }
  }

  return result;
}

// GET method for testing
export async function GET() {
  return NextResponse.json({
    message: 'Orders bulk API endpoint',
    supportedActions: ['updateStatus', 'schedule', 'export', 'delete'],
    method: 'POST',
  });
}
