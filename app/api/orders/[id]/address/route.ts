import {
  ApiError,
  createSuccessResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import {
  UNIFIED_ORDER_INCLUDE,
  mapOrderToUnified,
  upsertUnifiedOrder,
} from '@/lib/data/ordersRedis';
import { logger } from '@/lib/logger';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { addressIntelService } from '@/lib/services/address/AddressIntelligenceService';
import { getProductionOrdersService } from '@/lib/services/production';
import { isTenantRuntime } from '@/lib/tenancy/context';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ordersService = getProductionOrdersService();

const updateAddressSchema = z.object({
  city: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  floor: z.string().optional(),
  apartment: z.string().optional(),
});

export const POST = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const normalized = await addressIntelService.normalizeOrderAddress(params.id, { force: true });
    logger.info('Address normalization rerun', {
      orderId: params.id,
      status: normalized?.validationStatus,
    });
    return createSuccessResponse({ normalized });
  },
  { permissions: ['EDIT_ORDERS'] }
);

export const PATCH = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const orderId = params.id;
      const data = (await validateRequest(updateAddressSchema)(req)) as z.infer<
        typeof updateAddressSchema
      >;

      // We need to update the Shipping Address of the order.
      // NOTE: This assumes we are updating the shipping address directly.
      // Since address is a related entity, we should ideally update the Address entity.

      // Get the order to find the shipping address ID
      // Get the order from DB directly to ensure we have the latest state and valid relations
      const { getPrismaClient } = await import('@/lib/db');
      const prisma = getPrismaClient();

      if (isTenantRuntime()) {
        await prisma.$transaction(async (tx) => {
          // Same lock order as source updates: order first, then its address.
          await tx.$queryRaw`SELECT id FROM orders WHERE id=${orderId}::uuid FOR UPDATE`;
          const scoped = await tx.order.findUnique({
            where: { id: orderId },
            include: { shippingAddress: true },
          });
          if (!scoped) throw new ApiError('NOT_FOUND', 'ההזמנה לא נמצאה', 404);
          const updatedAddress = await tx.address.update({
            where: { id: scoped.shippingAddressId },
            data,
          });
          await tx.order.update({
            where: { id: orderId },
            data: {
              city: updatedAddress.city,
              street: updatedAddress.street,
              houseNumber: updatedAddress.number,
              floor: updatedAddress.floor,
              apartment: updatedAddress.apartment,
              addressLine: [updatedAddress.street, updatedAddress.number].filter(Boolean).join(' '),
            },
          });
          await tx.orderLog.create({
            data: {
              orderId,
              userId: user.id,
              action: 'LOCAL_ADDRESS_EDIT',
              metadata: { protectedFromStore: Boolean(scoped.wooIntegrationId) },
            },
          });
        });
        return createSuccessResponse(
          await ordersService.getOrderById(orderId),
          undefined,
          'הכתובת נשמרה'
        );
      }

      let order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { shippingAddress: true },
      });

      if (!order) {
        // Fallback: Check Redis for "ghost" order (exists in cache but not DB)
        const { getUnifiedOrder } = await import('@/lib/data/ordersRedis');
        const unified = await getUnifiedOrder(orderId);

        if (unified) {
          logger.warn('Restoring missing order from Redis', { orderId });

          try {
            // 1. Restore Customer
            if (unified.customer) {
              await prisma.customer.upsert({
                where: { id: unified.customer.id },
                update: {},
                create: {
                  id: unified.customer.id,
                  name: unified.customer.name,
                  email: unified.customer.email || '',
                  phone: unified.customer.phone || '',
                },
              });
            }

            // 2. Restore Address
            const shipAddrId = unified.shippingAddressId || (await import('crypto')).randomUUID();

            // Check if address exists to avoid unique constraint error if ID reuse
            const addrExists = await prisma.address.findUnique({ where: { id: shipAddrId } });
            if (!addrExists) {
              await prisma.address.create({
                data: {
                  id: shipAddrId,
                  city: unified.shippingAddress?.city || 'לא ידוע',
                  street: unified.shippingAddress?.street || 'לא ידוע',
                  number: unified.shippingAddress?.number || '0',
                  floor: unified.shippingAddress?.floor,
                  apartment: unified.shippingAddress?.apartment,
                  type: 'SHIPPING',
                  customerId: unified.customerId,
                },
              });
            }

            // 3. Restore Order
            const channel = unified.source === 'woo' ? 'WOOCOMMERCE' : 'MANUAL';

            await prisma.order.create({
              data: {
                id: unified.id,
                number: unified.number,
                status: unified.status as any,
                customerId: unified.customerId,
                shippingAddressId: shipAddrId,
                billingAddressId: shipAddrId, // Reuse for billing
                channel: channel as any,
                totalCents: unified.totalAmountCents,
                currency: unified.currency || 'ILS',
                createdAt: new Date(unified.createdAt),
                updatedAt: new Date(unified.updatedAt),
                // If installationTaskId exists in Redis, we can't easily link it here if it's external
              },
            });

            // Refetch
            order = await prisma.order.findUnique({
              where: { id: orderId },
              include: { shippingAddress: true },
            });
          } catch (restoreError: any) {
            logger.error('Failed to restore order from Redis', { error: restoreError.message });
            throw new ApiError(
              'internal_error',
              'Failed to restore missing order: ' + restoreError.message,
              500
            );
          }
        }

        if (!order) {
          throw new ApiError('order_not_found', 'Order not found', 404);
        }
      }

      const addressData = {
        city: data.city || order.shippingAddress?.city || 'לא ידוע',
        street: data.street || order.shippingAddress?.street || 'לא ידוע',
        number: data.number || order.shippingAddress?.number || '0',
        floor: data.floor !== undefined ? data.floor : order.shippingAddress?.floor,
        apartment: data.apartment !== undefined ? data.apartment : order.shippingAddress?.apartment,
      };

      if (order.shippingAddress) {
        // Address exists, update it
        await prisma.address.update({
          where: { id: order.shippingAddress.id },
          data: {
            city: data.city,
            street: data.street,
            number: data.number,
            floor: data.floor,
            apartment: data.apartment,
          },
        });
      } else {
        // Address missing (data corruption or legacy data), create it
        const newAddress = await prisma.address.create({
          data: {
            city: addressData.city,
            street: addressData.street,
            number: addressData.number,
            floor: addressData.floor,
            apartment: addressData.apartment,
            type: 'SHIPPING', // Default type
            customerId: order.customerId,
          },
        });

        // Link to order
        await prisma.order.update({
          where: { id: orderId },
          data: { shippingAddressId: newAddress.id },
        });
      }

      await prisma.order.update({
        where: { id: orderId },
        data: {
          city: data.city,
          street: data.street,
          houseNumber: data.number,
          floor: data.floor,
          apartment: data.apartment,
          addressLine: [
            data.street ?? order.shippingAddress?.street,
            data.number ?? order.shippingAddress?.number,
          ]
            .filter(Boolean)
            .join(' '),
        },
      });

      // Sync to Redis
      const freshOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: UNIFIED_ORDER_INCLUDE,
      });

      if (freshOrder) {
        const unified = mapOrderToUnified(freshOrder);
        await upsertUnifiedOrder(unified);
      }

      // Re-fetch full order DTO
      const updatedOrder = await ordersService.getOrderById(orderId);

      return createSuccessResponse(updatedOrder, undefined, 'Address updated successfully');
    } catch (error) {
      console.error(`[PATCH /api/orders/${params.id}/address] failed`, error);
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      if (error instanceof ApiError) {
        return NextResponse.json(
          { success: false, error: { code: error.code, message: error.message } },
          { status: error.statusCode }
        );
      }
      return asInternal();
    }
  }
);
