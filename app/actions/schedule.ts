'use server';

import { prisma } from '@/lib/db';
import { assertScheduleWithinDeliveryCapacity } from '@/lib/orders/deliveryCapacity';
import { InstallationTaskStatus, OrderStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const ScheduleSchema = z.object({
  orderId: z.string().min(1),
  technicianId: z.string().min(1),
  scheduledDate: z.date(),
  notes: z.string().optional(),
});

export type ScheduleOrderState = {
  success?: boolean;
  error?: string;
  message?: string;
};

export async function assignOrderToInstaller(
  prevState: ScheduleOrderState,
  formData: FormData
): Promise<ScheduleOrderState> {
  try {
    const rawDate = formData.get('date') as string;
    const rawTime = formData.get('time') as string;

    // Combine date and time
    const scheduledDate = new Date(`${rawDate}T${rawTime}`);

    const validatedFields = ScheduleSchema.parse({
      orderId: formData.get('orderId'),
      technicianId: formData.get('technicianId'),
      scheduledDate,
      notes: formData.get('notes'),
    });

    if (isNaN(validatedFields.scheduledDate.getTime())) {
      return { error: 'Invalid date or time provided' };
    }

    const { orderId, technicianId, scheduledDate: date, notes } = validatedFields;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shippingAddress: {
          select: {
            city: true,
            street: true,
            number: true,
            lat: true,
            lng: true,
          },
        },
      },
    });

    if (!order) {
      return { error: 'הזמנה לא נמצאה' };
    }

    await assertScheduleWithinDeliveryCapacity({
      orderId: order.id,
      orderNumber: order.number,
      currentStatus: String(OrderStatus.SCHEDULED),
      scheduledAt: date,
      fulfillmentType: order.fulfillmentType,
      address:
        order.shippingAddress?.city &&
        order.shippingAddress?.street &&
        order.shippingAddress?.number
          ? {
              city: order.shippingAddress.city,
              street: order.shippingAddress.street,
              number: order.shippingAddress.number,
              lat: order.shippingAddress.lat ?? undefined,
              lng: order.shippingAddress.lng ?? undefined,
            }
          : null,
      fallbackAddressLine:
        order.addressLine ||
        [order.shippingAddress?.street, order.shippingAddress?.number].filter(Boolean).join(' ') ||
        null,
      fallbackCity: order.city ?? order.shippingAddress?.city ?? null,
      fallbackLat: order.lat ?? order.latitude ?? order.shippingAddress?.lat ?? null,
      fallbackLng: order.lng ?? order.longitude ?? order.shippingAddress?.lng ?? null,
    });

    // Transaction: Create Installation Task + Update Order Status
    await prisma.$transaction(async (tx) => {
      // 1. Create Installation Task
      // Check if task already exists? Ideally we might want to update if exists,
      // but for "Unscheduled" flow usually means creating new.
      // Let's upsert to be safe or just create.

      const existingTask = await tx.installationTask.findFirst({
        where: { orderId },
      });

      if (existingTask) {
        await tx.installationTask.update({
          where: { id: existingTask.id },
          data: {
            technicianId,
            scheduledDate: date,
            status: InstallationTaskStatus.SCHEDULED,
            notes: notes || existingTask.notes,
          },
        });
      } else {
        await tx.installationTask.create({
          data: {
            orderId,
            technicianId,
            scheduledDate: date,
            status: InstallationTaskStatus.SCHEDULED,
            notes,
          },
        });
      }

      // 2. Update Order Status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.SCHEDULED,
          scheduledAt: date,
        },
      });
    });

    revalidatePath('/dashboard/operations');
    return { success: true, message: 'ההזמנה שובצה בהצלחה' };
  } catch (error) {
    console.error('Failed to schedule order:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to schedule order. Please try again.',
    };
  }
}

export async function getInstallers() {
  // Assuming 'technician' is a role or we fetch all users for now.
  // Adjust based on your User model.
  // If RBAC is implemented, fetch users with 'INSTALLER' role.
  // For now, looking for users in the system.

  // Attempt to fetch users with role 'INSTALLER' or 'TECHNICIAN' if exists
  // Fallback: fetch all users
  try {
    const installers = await prisma.user.findMany({
      where: {
        role: 'INSTALLER', // Adjust if your enum is different
      },
      select: { id: true, name: true },
    });

    // If no strict role, maybe return all? Or return mock if empty for dev?
    if (installers.length === 0) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, role: true },
      });
      // return all for now to ensure dropdown isn't empty in demo
      return allUsers;
    }

    return installers;
  } catch (e) {
    console.error('Error fetching installers', e);
    return [];
  }
}
