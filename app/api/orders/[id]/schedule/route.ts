import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { createInstallationEvent } from '@/lib/calendar';
import {
  UNIFIED_ORDER_INCLUDE,
  mapOrderToUnified,
  upsertUnifiedOrder,
} from '@/lib/data/ordersRedis';
import { prisma } from '@/lib/db';
import {
  acquireOrderMutationLock,
  assertOrderVersion,
  parseOrderVersionToken,
} from '@/lib/orders/concurrency';
import { assertScheduleWithinDeliveryCapacity } from '@/lib/orders/deliveryCapacity';
import { resolveScheduleAddress } from '@/lib/orders/deliveryScheduling';
import { applyDeferredOrdersToNextBusinessDay } from '@/lib/orders/deliveryRebalance';
import { invalidateOrderReadModels } from '@/lib/orders/invalidateOrderReadModels';
import { schedulePayloadSchema } from '@/lib/orders/scheduleValidation';
import { ORDER_WITH_RELATIONS_INCLUDE, serializeOrder } from '@/lib/serializers/orderSerializer';
import { mapErrorToResponse } from '@/lib/server/errors';
import { ExternalCalendarSyncService } from '@/lib/services/calendar/ExternalCalendarSyncService';
import { syncOrderOperationalState } from '@/lib/services/orders/statusRecalculation';
import {
  DEFAULT_WORKSPACE_STORE_ID,
  InstallationGoogleCalendarService,
} from '@/lib/services/google-workspace/InstallationGoogleCalendarService';
import { AddressType, FulfillmentType, GoogleWorkspaceIntegrationStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const parseResult = schedulePayloadSchema.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: parseResult.error.errors },
          { status: 400 }
        );
      }

      const payload = parseResult.data;
      const expectedVersionToken =
        payload.expectedUpdatedAt ??
        req.headers.get('if-match') ??
        req.headers.get('if-unmodified-since');
      const expectedUpdatedAt = parseOrderVersionToken(expectedVersionToken);

      if (expectedVersionToken && !expectedUpdatedAt) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'validation_error',
              message: 'Invalid expectedUpdatedAt / If-Match header format',
            },
          },
          { status: 400 }
        );
      }

      const installAt = new Date(payload.scheduledAt);
      const scheduledEnd = payload.scheduledEnd ? new Date(payload.scheduledEnd) : undefined;
      const installerName =
        payload.installerName === undefined ? undefined : (payload.installerName ?? null);
      const installerNotes =
        payload.installerNotes === undefined ? undefined : (payload.installerNotes ?? null);
      const installerId = payload.installerId ?? null;
      const currentOrderForPlanning = await prisma.order.findUnique({
        where: { id: params.id },
        include: {
          shippingAddress: {
            select: {
              city: true,
              street: true,
              number: true,
              floor: true,
              notes: true,
              lat: true,
              lng: true,
            },
          },
        },
      });

      if (!currentOrderForPlanning) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const resolvedAddressForPlanning = resolveScheduleAddress(
        currentOrderForPlanning,
        payload.address
      );
      const effectiveFulfillmentTypeForPlanning =
        payload.fulfillmentType ?? currentOrderForPlanning.fulfillmentType;

      const capacityResult = await assertScheduleWithinDeliveryCapacity(
        {
          orderId: params.id,
          orderNumber: currentOrderForPlanning.number,
          currentStatus: String(
            payload.status ??
              (effectiveFulfillmentTypeForPlanning === FulfillmentType.DELIVERY
                ? 'SCHEDULED'
                : currentOrderForPlanning.status)
          ),
          scheduledAt: installAt,
          scheduledEnd,
          timeWindowStart: payload.timeWindowStart ?? null,
          timeWindowEnd: payload.timeWindowEnd ?? null,
          durationMinutes:
            payload.durationMinutes ?? currentOrderForPlanning.durationOverrideMinutes,
          fulfillmentType: effectiveFulfillmentTypeForPlanning,
          address: resolvedAddressForPlanning
            ? {
                city: resolvedAddressForPlanning.city,
                street: resolvedAddressForPlanning.street,
                number: resolvedAddressForPlanning.number,
                lat: resolvedAddressForPlanning.lat,
                lng: resolvedAddressForPlanning.lng,
              }
            : null,
          fallbackAddressLine:
            currentOrderForPlanning.addressLine ||
            (currentOrderForPlanning.shippingAddress
              ? [
                  currentOrderForPlanning.shippingAddress.street,
                  currentOrderForPlanning.shippingAddress.number,
                ]
                  .filter(Boolean)
                  .join(' ')
              : null),
          fallbackCity:
            currentOrderForPlanning.city ?? currentOrderForPlanning.shippingAddress?.city ?? null,
          fallbackLat:
            currentOrderForPlanning.lat ??
            currentOrderForPlanning.latitude ??
            currentOrderForPlanning.shippingAddress?.lat ??
            null,
          fallbackLng:
            currentOrderForPlanning.lng ??
            currentOrderForPlanning.longitude ??
            currentOrderForPlanning.shippingAddress?.lng ??
            null,
        },
        { autoRebalance: true }
      );

      let autoRebalancedOrders: Array<{
        id: string;
        number: string;
        scheduledAt: Date;
        scheduledEnd: Date | null;
        deferredDateKey: string;
      }> = [];

      await prisma.$transaction(async (tx) => {
        await acquireOrderMutationLock(tx, params.id);
        await assertOrderVersion(tx, params.id, expectedUpdatedAt);

        const currentOrder = await tx.order.findUnique({
          where: { id: params.id },
          include: {
            shippingAddress: {
              select: {
                city: true,
                street: true,
                number: true,
                floor: true,
                notes: true,
                lat: true,
                lng: true,
              },
            },
          },
        });

        if (!currentOrder) {
          throw new Error('Order not found');
        }

        const resolvedAddress = resolveScheduleAddress(currentOrder, payload.address);

        if (resolvedAddress) {
          await tx.address.upsert({
            where: { id: currentOrder.shippingAddressId },
            update: {
              city: resolvedAddress.city,
              street: resolvedAddress.street,
              number: resolvedAddress.number,
              floor: resolvedAddress.floor,
              notes: resolvedAddress.notes,
              lat: resolvedAddress.lat,
              lng: resolvedAddress.lng,
            },
            create: {
              id: currentOrder.shippingAddressId,
              customerId: currentOrder.customerId,
              type: AddressType.SHIPPING,
              city: resolvedAddress.city,
              street: resolvedAddress.street,
              number: resolvedAddress.number,
              floor: resolvedAddress.floor,
              notes: resolvedAddress.notes,
              lat: resolvedAddress.lat,
              lng: resolvedAddress.lng,
            },
          });
        }

        // Update legacy fields + address hints + new scheduling fields
        await tx.order.update({
          where: { id: params.id },
          data: {
            scheduledAt: installAt,
            scheduledEnd,
            fulfillmentType: payload.fulfillmentType,
            scheduleMode: payload.scheduleMode,
            timeWindowStart: payload.timeWindowStart,
            timeWindowEnd: payload.timeWindowEnd,
            notesToCrew: payload.notesToCrew,
            durationOverrideMinutes: payload.durationMinutes,
            installerName,
            installerNotes,
            assignedUserId: installerId ?? undefined,
            city: resolvedAddress?.city,
            street: resolvedAddress?.street,
            houseNumber: resolvedAddress?.number,
            floor: resolvedAddress?.floor,
            apartment: resolvedAddress?.apartment,
            addressLine: resolvedAddress
              ? `${resolvedAddress.street} ${resolvedAddress.number}, ${resolvedAddress.city}`
              : undefined,
            addressRaw: resolvedAddress
              ? `${resolvedAddress.street} ${resolvedAddress.number}, ${resolvedAddress.city}`
              : undefined,
            lat: resolvedAddress?.lat,
            lng: resolvedAddress?.lng,
            latitude: resolvedAddress?.lat,
            longitude: resolvedAddress?.lng,
            addressValidationStatus: resolvedAddress ? 'VALID' : undefined,
          },
        });

        // Upsert InstallationTask for Unified Model compatibility
        const existingTask = await tx.installationTask.findFirst({
          where: { orderId: params.id },
          select: { id: true },
        });

        if (existingTask) {
          await tx.installationTask.update({
            where: { id: existingTask.id },
            data: {
              scheduledDate: installAt,
              notes: installerNotes,
              status: 'PENDING',
              technicianId: installerId ?? undefined,
              city: resolvedAddress?.city,
              address: resolvedAddress
                ? `${resolvedAddress.street} ${resolvedAddress.number}`
                : undefined,
              lat: resolvedAddress?.lat,
              lng: resolvedAddress?.lng,
              durationMinutes: payload.durationMinutes ?? undefined,
            },
          });
        } else {
          await tx.installationTask.create({
            data: {
              orderId: params.id,
              scheduledDate: installAt,
              notes: installerNotes,
              status: 'PENDING',
              durationMinutes: payload.durationMinutes ?? 60,
              technicianId: installerId ?? undefined,
              city: resolvedAddress?.city,
              address: resolvedAddress
                ? `${resolvedAddress.street} ${resolvedAddress.number}`
                : undefined,
              lat: resolvedAddress?.lat,
              lng: resolvedAddress?.lng,
            },
          });
        }

        // Scheduling records the date only. Status changes go through the validated
        // status transition, so a client-sent status is ignored here.

        if (capacityResult.deferredOrders.length > 0) {
          autoRebalancedOrders = await applyDeferredOrdersToNextBusinessDay(tx, {
            orderIds: capacityResult.deferredOrders.map((order) => order.id),
            timezone: capacityResult.storeSettings.timezone,
          });
        }
      });

      if (payload.calendarSync) {
        try {
          const calendarService = new ExternalCalendarSyncService(prisma);
          // TODO: Implement proper calendar sync for orders
          // await calendarService.enableSyncForItem(`order:${params.id}`);
          console.warn('Calendar sync for orders not yet implemented');
        } catch (err) {
          console.warn('Calendar sync failed', err);
        }
      }

      const affectedOrderIds = Array.from(
        new Set([params.id, ...autoRebalancedOrders.map((order) => order.id)])
      );

      for (const affectedOrderId of affectedOrderIds) {
        await syncOrderOperationalState(affectedOrderId, {
          actorId: _user.id,
          reason:
            affectedOrderId === params.id ? 'תיאום הזמנה' : 'איזון אוטומטי של מסלול יומי',
        });
      }

      // Fetch fresh order with relations
      const updatedOrder = await prisma.order.findUnique({
        where: { id: params.id },
        include: ORDER_WITH_RELATIONS_INCLUDE,
      });

      if (!updatedOrder) throw new Error('Order not found after update');

      // Best-effort Google Calendar: OAuth workspace integration when ACTIVE, else legacy service account
      if (updatedOrder.scheduledAt) {
        const installEnd =
          updatedOrder.scheduledEnd ??
          new Date(updatedOrder.scheduledAt.getTime() + 60 * 60 * 1000);

        const workspaceIntegration = await prisma.workspaceGoogleIntegration.findUnique({
          where: { storeId: DEFAULT_WORKSPACE_STORE_ID },
        });

        if (workspaceIntegration?.status === GoogleWorkspaceIntegrationStatus.ACTIVE) {
          try {
            const installationCalendar = new InstallationGoogleCalendarService();
            await installationCalendar.syncInstallationEventForOrder(updatedOrder.id, {
              storeId: DEFAULT_WORKSPACE_STORE_ID,
              title: `התקנה ${updatedOrder.number}`,
              description: updatedOrder.installerNotes ?? undefined,
              location: updatedOrder.addressLine || updatedOrder.city || '',
              startTime: updatedOrder.scheduledAt,
              endTime: installEnd,
              createdByUserId: _user.id,
            });
          } catch (err) {
            console.warn('Workspace calendar sync failed (non-blocking)', err);
          }
        } else {
          try {
            await createInstallationEvent({
              id: updatedOrder.id,
              number: updatedOrder.number,
              customerName: updatedOrder.customerName || updatedOrder.customer?.name || 'לקוח',
              note: updatedOrder.installerNotes || undefined,
              address: updatedOrder.addressLine || updatedOrder.city || '',
              city: updatedOrder.city || undefined,
              installAt: updatedOrder.scheduledAt,
            });
          } catch (err) {
            console.warn('Calendar event creation failed (non-blocking)', err);
          }
        }
      }

      // Sync Redis snapshot
      for (const affectedOrderId of affectedOrderIds) {
        const fullOrder = await prisma.order.findUnique({
          where: { id: affectedOrderId },
          include: UNIFIED_ORDER_INCLUDE,
        });
        if (fullOrder) {
          await upsertUnifiedOrder(mapOrderToUnified(fullOrder as any));
        }
        await invalidateOrderReadModels(affectedOrderId);
      }

      return NextResponse.json(
        {
          ok: true,
          success: true,
          data: {
            order: serializeOrder(updatedOrder as any),
            autoRebalanced:
              autoRebalancedOrders.length > 0
                ? {
                    count: autoRebalancedOrders.length,
                    orders: autoRebalancedOrders.map((order) => ({
                      id: order.id,
                      number: order.number,
                      scheduledAt: order.scheduledAt.toISOString(),
                      deferredDateKey: order.deferredDateKey,
                    })),
                  }
                : null,
          },
        },
        { status: 200 }
      );
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      console.error('Error scheduling order:', error);
      return NextResponse.json({ error: 'Failed to schedule order' }, { status: 500 });
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);

// Backward-compatible alias used by ops dashboard actions.
export const POST = PATCH;

export const DELETE = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const expectedVersionToken =
        _req.headers.get('if-match') ?? _req.headers.get('if-unmodified-since');
      const expectedUpdatedAt = parseOrderVersionToken(expectedVersionToken);

      if (expectedVersionToken && !expectedUpdatedAt) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'validation_error',
              message: 'Invalid If-Match header format',
            },
          },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await acquireOrderMutationLock(tx, params.id);
        await assertOrderVersion(tx, params.id, expectedUpdatedAt);

        // Clear legacy fields + new scheduling fields
        await tx.order.update({
          where: { id: params.id },
          data: {
            scheduledAt: null,
            scheduledEnd: null,
            timeWindowStart: null,
            timeWindowEnd: null,
            notesToCrew: null,
            installerName: null,
            installerNotes: null,
          },
        });

        // Remove Installation Tasks
        await tx.installationTask.deleteMany({
          where: { orderId: params.id },
        });
      });

      await syncOrderOperationalState(params.id, {
        actorId: _user.id,
        reason: 'ביטול תיאום',
      });

      const order = await prisma.order.findUnique({
        where: { id: params.id },
        include: ORDER_WITH_RELATIONS_INCLUDE,
      });

      if (!order) throw new Error('Order not found after update');

      return NextResponse.json(
        {
          ok: true,
          success: true,
          data: {
            order: serializeOrder(order as any),
          },
        },
        { status: 200 }
      );
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      console.error('Error removing schedule from order:', error);
      return NextResponse.json({ error: 'Failed to remove schedule' }, { status: 500 });
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);
