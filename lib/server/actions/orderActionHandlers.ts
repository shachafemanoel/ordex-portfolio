import { prisma } from '@/lib/db';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

type ActionHandler = (orderId: string, payload: any, userId: string) => Promise<any>;

const createAuditLog = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  actionId: string,
  userId: string,
  before: any,
  after: any,
  metadata?: any
) => {
  // AuditLog model removed - logging to console
  console.log('AUDIT LOG:', {
    entity: 'orders',
    entityId: orderId,
    action: actionId,
    actorId: userId,
    before,
    after,
    metadata,
  });
  /*
  await tx.auditLog.create({
    data: {
      entity: 'orders',
      entityId: orderId,
      action: actionId,
      actorId: userId,
      before: before ? JSON.parse(JSON.stringify(before)) : undefined,
      after: after ? JSON.parse(JSON.stringify(after)) : undefined,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      status: 'SUCCESS'
    }
  });
  */
};

const handleReceiveGoods: ActionHandler = async (orderId, payload, userId) => {
  // Support both 'items' (web) and 'receivedItems' (iOS)
  const itemsList = payload.receivedItems || payload.items || [];
  
  const items = itemsList.map((item: any) => ({
    id: item.itemId || item.id,
    receivedQuantity: item.receivedQuantity ?? 0,
    received: item.isReceived ?? item.received ?? false,
  }));

  if (items.length === 0 && itemsList.length > 0) {
    throw new Error('Invalid items format for receipt');
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    const beforeState = { status: order.status, items: order.items };

    // Update items
    for (const itemPayload of items) {
      await tx.orderItem.update({
        where: { id: itemPayload.id },
        data: {
          receivedQuantity: itemPayload.receivedQuantity,
          received: itemPayload.received,
          updatedAt: new Date(),
        },
      });
    }

    // Re-fetch items to check status
    const updatedItems = await tx.orderItem.findMany({ where: { orderId } });

    const allReceived = updatedItems.every((i) => i.received || i.receivedQuantity >= i.qty);
    const anyReceived = updatedItems.some((i) => i.received || i.receivedQuantity > 0);

    let newStatus: OrderStatus = order.status;
    if (allReceived) {
      newStatus = 'READY_FOR_INSTALL';
    } else if (anyReceived) {
      newStatus = 'PARTIALLY_SUPPLIED';
    }

    let updatedOrder = order;
    if (newStatus !== order.status) {
      updatedOrder = (await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      })) as any;

      // Status history
      await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: newStatus,
          changedBy: userId,
          reason: 'קליטת סחורה (Action)',
        },
      });
    }

    await createAuditLog(tx, orderId, 'receive-goods', userId, beforeState, {
      status: newStatus,
      items: updatedItems,
    });

    return updatedOrder;
  });
};

const handlePrepareShipment: ActionHandler = async (orderId, payload, userId) => {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const beforeState = { status: order.status };

    const newStatus: OrderStatus = 'READY';

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { 
        status: newStatus,
        statusUpdatedAt: new Date()
      },
    });

    if (order.status !== newStatus) {
      await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: newStatus,
          changedBy: userId,
          reason: payload.note || 'הכנה למשלוח',
        },
      });
    }

    await createAuditLog(tx, orderId, 'prepare-shipment', userId, beforeState, { status: newStatus });
    return updatedOrder;
  });
};

const handleOpenNavigation: ActionHandler = async (orderId, payload, userId) => {
  // Purely logging action for now as it's a client-side intent
  console.log(`[NAV] User ${userId} opened navigation for order ${orderId}`);
  return { success: true };
};


const handleUpdatePayment: ActionHandler = async (orderId, payload, userId) => {
  const data = payload as {
    method: string;
    amountCents: number;
    status: PaymentStatus;
    reference?: string;
    notes?: string;
  };

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
    });

    const beforeState = {
      paymentStatus: order.paymentStatus,
      paidAmountCents: order.paidAmountCents,
    };

    // Create Payment record
    const payment = await tx.payment.create({
      data: {
        orderId,
        method: data.method as any,
        status: data.status,
        amountCents: data.amountCents,
        reference: data.reference,
        notes: data.notes,
        processedBy: userId,
        paymentDate: new Date(),
      },
    });

    // Update Order totals (simplistic logic: sum all APPROVED/PAID payments)
    const allPayments = await tx.payment.findMany({
      where: { orderId, status: { in: ['PAID', 'AUTHORIZED', 'PARTIAL'] } },
    });

    const totalPaid = allPayments.reduce((sum, p) => sum + p.amountCents, 0);

    let newPaymentStatus: PaymentStatus = 'PENDING';
    if (totalPaid >= order.totalCents && order.totalCents > 0) {
      newPaymentStatus = 'PAID';
    } else if (totalPaid > 0) {
      newPaymentStatus = 'PARTIAL';
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        paidAmountCents: totalPaid,
        paymentStatus: newPaymentStatus,
        lastPaymentAt: new Date(),
      },
    });

    await createAuditLog(
      tx,
      orderId,
      'update-payment',
      userId,
      beforeState,
      { paymentStatus: newPaymentStatus, paidAmountCents: totalPaid },
      { paymentId: payment.id }
    );

    return updatedOrder;
  });

  const notifyStatuses: PaymentStatus[] = [
    PaymentStatus.PAID,
    PaymentStatus.AUTHORIZED,
    PaymentStatus.PARTIAL,
  ];
  if (data.amountCents > 0 && notifyStatuses.includes(data.status)) {
    void import('@/lib/push/webPush')
      .then(({ notifyPaymentReceivedWebPush }) =>
        notifyPaymentReceivedWebPush({
          orderId,
          orderNumber: updatedOrder.number,
          amountCents: data.amountCents,
        })
      )
      .catch(() => undefined);
  }

  return updatedOrder;
};

const handleUpdateAddress: ActionHandler = async (orderId, payload, userId) => {
  // Payload matches Address schema
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { shippingAddress: true },
    });

    const beforeState = { shippingAddress: order.shippingAddress };

    // Update Shipping Address
    await tx.address.update({
      where: { id: order.shippingAddressId },
      data: {
        city: payload.city,
        street: payload.street,
        number: payload.number,
        floor: payload.floor,
        // apartment: payload.apartment, // Schema Address doesn't have apartment in `Address` model (checked schema), but Order has `apartment`?
        // Let's check schema again. Address has `floor`, no `apartment`?
        // Address: city, street, number, floor, notes, lat, lng.
        // Order: city, street, houseNumber, floor, apartment.
        notes: payload.notes,
        lat: payload.lat,
        lng: payload.lng,
      },
    });

    // Update Order denormalized fields
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        city: payload.city,
        street: payload.street,
        houseNumber: payload.number,
        floor: payload.floor,
        apartment: payload.apartment, // Order has apartment
        lat: payload.lat,
        lng: payload.lng,
        addressRaw: `${payload.street} ${payload.number}, ${payload.city}`,
      },
    });

    await createAuditLog(tx, orderId, 'update-address', userId, beforeState, payload);

    return updatedOrder;
  });
};

function resolveScheduledActionAddress(
  order: {
    city: string | null;
    street: string | null;
    houseNumber: string | null;
    floor: string | null;
    lat: number | null;
    lng: number | null;
    shippingAddress: {
      city: string;
      street: string;
      number: string;
      floor: string | null;
      lat: number | null;
      lng: number | null;
    } | null;
  },
  payloadAddress?: {
    city?: string | null;
    street?: string | null;
    number?: string | null;
    floor?: string | null;
    lat?: number | null;
    lng?: number | null;
  }
) {
  const city = payloadAddress?.city ?? order.shippingAddress?.city ?? order.city ?? undefined;
  const street =
    payloadAddress?.street ?? order.shippingAddress?.street ?? order.street ?? undefined;
  const number =
    payloadAddress?.number ??
    order.shippingAddress?.number ??
    order.houseNumber ??
    undefined;

  if (!city || !street || !number) {
    return null;
  }

  return {
    city,
    street,
    number,
    floor: payloadAddress?.floor ?? order.shippingAddress?.floor ?? order.floor ?? undefined,
    lat: payloadAddress?.lat ?? order.shippingAddress?.lat ?? order.lat ?? undefined,
    lng: payloadAddress?.lng ?? order.shippingAddress?.lng ?? order.lng ?? undefined,
  };
}

const handleScheduleInstallation: ActionHandler = async (orderId, payload, userId) => {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        shippingAddress: true,
        installationTasks: {
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const beforeState = { status: order.status, scheduledAt: order.scheduledAt };

    const scheduledDate = new Date(payload.scheduledAt);
    const resolvedAddress = resolveScheduledActionAddress(order, payload.address);

    if (resolvedAddress) {
      await tx.address.update({
        where: { id: order.shippingAddressId },
        data: {
          city: resolvedAddress.city,
          street: resolvedAddress.street,
          number: resolvedAddress.number,
          floor: resolvedAddress.floor,
          lat: resolvedAddress.lat,
          lng: resolvedAddress.lng,
        },
      });
    }

    // Update Order
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        scheduledAt: scheduledDate,
        installerName: payload.installerName,
        installerNotes: payload.installerNotes,
        status: 'SCHEDULED',
        city: resolvedAddress?.city,
        street: resolvedAddress?.street,
        houseNumber: resolvedAddress?.number,
        floor: resolvedAddress?.floor,
        addressLine: resolvedAddress
          ? `${resolvedAddress.street} ${resolvedAddress.number}, ${resolvedAddress.city}`
          : undefined,
        lat: resolvedAddress?.lat,
        lng: resolvedAddress?.lng,
        latitude: resolvedAddress?.lat,
        longitude: resolvedAddress?.lng,
      },
    });

    const existingTaskId = order.installationTasks[0]?.id;
    if (existingTaskId) {
      await tx.installationTask.update({
        where: { id: existingTaskId },
        data: {
          scheduledDate,
          status: 'SCHEDULED',
          notes: payload.installerNotes,
          city: resolvedAddress?.city,
          address: resolvedAddress
            ? `${resolvedAddress.street} ${resolvedAddress.number}`
            : undefined,
          lat: resolvedAddress?.lat,
          lng: resolvedAddress?.lng,
        },
      });
    } else {
      await tx.installationTask.create({
        data: {
          orderId,
          scheduledDate,
          status: 'SCHEDULED',
          notes: payload.installerNotes,
          city: resolvedAddress?.city,
          address: resolvedAddress
            ? `${resolvedAddress.street} ${resolvedAddress.number}`
            : undefined,
          lat: resolvedAddress?.lat,
          lng: resolvedAddress?.lng,
        },
      });
    }

    // Status history
    if (order.status !== 'SCHEDULED') {
      await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: 'SCHEDULED',
          changedBy: userId,
          reason: 'Schedule Installation Action',
        },
      });
    }

    await createAuditLog(tx, orderId, 'schedule-installation', userId, beforeState, {
      scheduledAt: scheduledDate,
      status: 'SCHEDULED',
    });

    return updatedOrder;
  });
};

const handleApproveItems: ActionHandler = async (orderId, payload, userId) => {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const beforeState = { status: order.status };

    // Determine target status: Move to 'TO_DO' (Active) if currently Draft/Pending
    let newStatus: OrderStatus = order.status;
    if (['DRAFT', 'PENDING_APPROVAL'].includes(order.status)) {
      newStatus = 'TO_DO';
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        isDraft: false, // Ensure it's not draft anymore
        statusUpdatedAt: new Date(),
      },
    });

    if (order.status !== newStatus) {
      await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: newStatus,
          changedBy: userId,
          reason: 'Items Confirmed',
        },
      });
    }

    await createAuditLog(tx, orderId, 'approve-items', userId, beforeState, {
      status: newStatus,
      isDraft: false,
    });

    return updatedOrder;
  });
};

const handleMarkSupplied: ActionHandler = async (orderId, payload, userId) => {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const beforeState = { status: order.status };

    const newStatus: OrderStatus = 'SUPPLIED';

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        statusUpdatedAt: new Date(),
        completedAt: new Date(),
      },
    });

    if (order.status !== newStatus) {
      await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: newStatus,
          changedBy: userId,
          reason: payload.note || 'סימון כסופק (Action)',
        },
      });
    }

    await createAuditLog(tx, orderId, 'mark-supplied', userId, beforeState, { status: newStatus });
    return updatedOrder;
  });
};

const handlePartialInstall: ActionHandler = async (orderId, payload, userId) => {
  const itemsList = payload.installedItems || [];

  const items = itemsList.map((item: any) => ({
    id: item.itemId || item.id,
    installedQuantity: item.installedQuantity ?? 0,
    isInstalled: item.isInstalled ?? false,
  }));

  if (items.length === 0 && itemsList.length > 0) {
    throw new Error('Invalid items format for installation');
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    const beforeState = { status: order.status, items: order.items };

    // Update items
    for (const itemPayload of items) {
      await tx.orderItem.update({
        where: { id: itemPayload.id },
        data: {
          // Note: installedQuantity field added to schema but migration might be pending
          installedQuantity: itemPayload.installedQuantity,
          status: itemPayload.isInstalled ? 'INSTALLED' : order.items.find(i => i.id === itemPayload.id)?.status,
          updatedAt: new Date(),
        } as any,
      });
    }

    // Re-fetch items to check status
    const updatedItems = await tx.orderItem.findMany({ where: { orderId } });

    const allInstalled = updatedItems.every((i) => i.status === 'INSTALLED');
    const anyInstalled = updatedItems.some((i) => i.status === 'INSTALLED');

    let newStatus: OrderStatus = order.status;
    if (allInstalled) {
      newStatus = 'INSTALLED';
    } else if (anyInstalled) {
      newStatus = 'INSTALLATION'; // In progress
    }

    let updatedOrder = order;
    if (newStatus !== order.status) {
      updatedOrder = (await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      })) as any;

      // Status history
      await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: newStatus,
          changedBy: userId,
          reason: payload.note || 'התקנה (Action)',
        },
      });
    }

    await createAuditLog(tx, orderId, 'partial-install', userId, beforeState, {
      status: newStatus,
      items: updatedItems,
    });

    return updatedOrder;
  });
};

export const ORDER_ACTION_HANDLERS: Record<string, ActionHandler> = {
  'receive-goods': handleReceiveGoods,
  'RECEIVE_ITEMS': handleReceiveGoods,
  'update-payment': handleUpdatePayment,
  'CONFIRM_PAYMENT': handleUpdatePayment,
  'update-address': handleUpdateAddress,
  'schedule-installation': handleScheduleInstallation,
  'SCHEDULE_INSTALLATION': handleScheduleInstallation,
  'approve-items': handleApproveItems,
  'CONFIRM_DETAILS': handleApproveItems,
  'prepare-shipment': handlePrepareShipment,
  'PREPARE_SHIPMENT': handlePrepareShipment,
  'open-navigation': handleOpenNavigation,
  'OPEN_NAVIGATION': handleOpenNavigation,
  'mark-supplied': handleMarkSupplied,
  'MARK_SUPPLIED': handleMarkSupplied,
  'partial-install': handlePartialInstall,
  'PARTIAL_INSTALL': handlePartialInstall,
};

