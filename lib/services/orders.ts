import { OrderItem, Prisma } from '@prisma/client';

// PaymentMethod, PaymentStatus, VatCategory were removed from Prisma schema; define locally
const PaymentStatus = {
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIAL: 'PARTIAL',
} as const;
type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

const PaymentMethod = {
  CASH: 'CASH',
  CHECK: 'CHECK',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  BIT: 'BIT',
  PAYPAL: 'PAYPAL',
  STRIPE: 'STRIPE',
  OTHER: 'OTHER',
} as const;
type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

const VatCategory = {
  STANDARD: 'STANDARD',
  REDUCED: 'REDUCED',
  ZERO: 'ZERO',
  EXEMPT: 'EXEMPT',
} as const;
type VatCategory = (typeof VatCategory)[keyof typeof VatCategory];

import { prisma } from '@/lib/db';
import { isDemo } from '@/lib/featureFlags';
import { acquireOrderMutationLock, assertOrderVersion } from '@/lib/orders/concurrency';
import { invalidateOrderReadModels } from '@/lib/orders/invalidateOrderReadModels';
import { assertPaymentStatus } from '@/lib/payments/status';
import { PurchaseOrderService } from '@/lib/purchase-orders';
import { DomainError } from '@/lib/server/errors';
import {
  recordOrderAdjustment,
  recordOrderCharge,
  recordOrderPayment,
} from '@/lib/services/customerLedger';
import { OrderAutomationService } from '@/lib/services/order-automation';
import { syncOrderOperationalState } from '@/lib/services/orders/statusRecalculation';
import { getStoreSettings } from '@/lib/store-settings';
import { OrderCreateInput, OrderCreateItemInput, OrderPaymentInput } from '@/lib/validators/order';

export type AllocationStatusValue = 'PENDING' | 'ALLOCATED' | 'OUT_OF_STOCK' | 'ON_ORDER';

export interface ItemAllocationUpdateInput {
  itemId: string;
  status: AllocationStatusValue;
  supplierId?: string | null;
}

interface ItemAllocationMutationOptions {
  expectedUpdatedAt?: Date | null;
  supplierId?: string | null;
}

type AuditEventClient = {
  auditEvent?: {
    create: (args: any) => Promise<any>;
  };
};

async function writeOrderAuditEvent(
  client: AuditEventClient,
  input: {
    orderId: string;
    action: string;
    actorId?: string | null;
    payload?: unknown;
    diff?: unknown;
    meta?: unknown;
  }
): Promise<void> {
  const delegate = client.auditEvent;
  if (!delegate?.create) {
    return;
  }

  await delegate.create({
    data: {
      orderId: input.orderId,
      action: input.action,
      actorId: input.actorId ?? null,
      payload: (input.payload ?? null) as Prisma.InputJsonValue,
      diff: (input.diff ?? null) as Prisma.InputJsonValue,
      meta: (input.meta ?? null) as Prisma.InputJsonValue,
    },
  });
}

type PaymentAggregateInput = {
  amountCents: number;
  status: PaymentStatus;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

const PAID_STATUS_SET = new Set<PaymentStatus>([PaymentStatus.PAID]);
const PAYMENT_METHOD_SET = new Set<PaymentMethod>(Object.values(PaymentMethod));

function assertPaymentMethod(method: string, context: string): PaymentMethod {
  const normalizedMethod = method.trim().toUpperCase();

  if (PAYMENT_METHOD_SET.has(normalizedMethod as PaymentMethod)) {
    return normalizedMethod as PaymentMethod;
  }

  throw new DomainError('invalid_payment_method', 400, {
    method,
    context,
  });
}

function summarizePayments(payments: PaymentAggregateInput[]) {
  if (payments.length === 0) {
    return {
      paidAmountCents: 0,
      paymentStatus: PaymentStatus.PENDING,
      lastPaymentAt: null as Date | null,
    };
  }

  const paidAmountCents = payments.reduce((sum, payment) => {
    return PAID_STATUS_SET.has(payment.status) ? sum + payment.amountCents : sum;
  }, 0);

  const timestamp = (payment: PaymentAggregateInput) =>
    (payment.updatedAt ?? payment.createdAt ?? null)?.getTime() ?? 0;

  const latest = [...payments].sort((a, b) => timestamp(b) - timestamp(a))[0];
  const lastPaymentAt = latest?.updatedAt ?? latest?.createdAt ?? null;

  return {
    paidAmountCents,
    paymentStatus: latest?.status ?? PaymentStatus.PENDING,
    lastPaymentAt,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function nextOrderNumber(
  tx: Prisma.TransactionClient,
  prefix: string = 'ORD-'
): Promise<string> {
  const lastOrder = await tx.order.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { number: true },
  });

  const re = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`);
  const match = lastOrder?.number ? lastOrder.number.match(re) : null;
  if (match) {
    const next = Number.parseInt(match[1], 10) + 1;
    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  return `${prefix}${Date.now()}`;
}

export async function generateOrderNumber(prefix: string = 'ORD-'): Promise<string> {
  return prisma.$transaction((tx) => nextOrderNumber(tx, prefix));
}

export function computeTotalCents(items: OrderCreateItemInput[]): number {
  return items.reduce((sum, item) => sum + (item.qtyRequested ?? 0) * (item.priceCents ?? 0), 0);
}

export async function createOrder(input: OrderCreateInput, userId: string) {
  if (!userId) {
    throw new DomainError('missing_user_id', 400);
  }

  // Track whether we should auto-generate POs after order creation
  let shouldGenerateAutoPO = false;
  let storeSettingsForAutoPO: Awaited<ReturnType<typeof getStoreSettings>> | null = null;

  // Some environments use a seeded fallback user id (e.g., 'avi-admin').
  // Since Order.createdByUserId references the User table (UUID), avoid
  // setting a foreign key with a non-UUID to prevent DB errors.
  const createdById = isValidUuid(userId) ? userId : undefined;

  // Create order expects an array of payments, but currently the schema only allows a single payment object.
  const paymentsInput: OrderPaymentInput[] = input.payment ? [input.payment] : [];

  // Load store settings (controls auto procurement & low stock threshold)
  const storeSettings = await getStoreSettings();
  storeSettingsForAutoPO = storeSettings; // Save for use after transaction

  // Normalize items to handle both OrderCreateInput (qtyRequested, priceCents)
  // and OrderCreateParsed (quantity, pricePerUnit) from the Zod transform
  const normalizedItems: OrderCreateItemInput[] = input.items.map((item: any) => {
    const qtyRequested = item.qtyRequested ?? item.quantity ?? 0;
    const priceCents =
      item.priceCents ?? (item.pricePerUnit ? Math.round(item.pricePerUnit * 100) : 0);
    return {
      ...item,
      qtyRequested,
      priceCents,
    };
  });

  const subTotalCents = computeTotalCents(normalizedItems);
  const taxRate = (storeSettings.taxRatePercent ?? 0) / 100;
  const taxCents = Math.round(subTotalCents * taxRate);
  const totalCents = subTotalCents + taxCents;

  const orderTransaction = prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: input.customerId },
      include: { addresses: true },
    });

    if (!customer) {
      throw new DomainError('customer_not_found', 404, { customerId: input.customerId });
    }

    const billingAddress = customer.addresses.find((address) => address.type === 'BILLING');
    const shippingAddress =
      customer.addresses.find((address) => address.type === 'SHIPPING') ?? billingAddress;

    if (!billingAddress || !shippingAddress) {
      throw new DomainError('customer_missing_address', 400, { customerId: input.customerId });
    }

    const productIds = Array.from(
      new Set(normalizedItems.map((item) => item.productId).filter(Boolean))
    ) as string[];
    const supplierIds = Array.from(
      new Set(normalizedItems.map((item) => item.supplierId).filter(Boolean))
    ) as string[];

    const [products, suppliers] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      }),
      tx.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true } }),
    ]);

    if (products.length !== productIds.length) {
      throw new DomainError('product_not_found', 400, { productIds });
    }

    if (suppliers.length !== supplierIds.length) {
      throw new DomainError('supplier_not_found', 400, { supplierIds });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const supplierSet = new Set(suppliers.map((supplier) => supplier.id));

    const orderNumber = await nextOrderNumber(tx, storeSettings.orderNumberPrefix || 'ORD-');

    let order = await tx.order.create({
      data: {
        number: orderNumber,
        customerId: input.customerId,
        ...(createdById
          ? {
              createdByUserId: createdById,
              assignedUserId: createdById,
            }
          : {}),
        billingAddressId: billingAddress.id,
        shippingAddressId: shippingAddress.id,
        status: 'DRAFT',
        channel: 'MANUAL',
        currency: storeSettings.defaultCurrency || 'ILS',
        totalCents,
        subTotalCents,
        taxCents,
        shippingCents: 0,
        discountCents: 0,
        notes: input.notes ?? null,
        addressLine: `${shippingAddress.street} ${shippingAddress.number}`,
        city: shippingAddress.city,
        demo: isDemo(),
      },
    });

    // Update customer aggregates: clv, orders count, first order date
    const existingAgg = await tx.customer.findUnique({
      where: { id: input.customerId },
      select: { firstOrderAt: true },
    });

    const newFirstOrderAt =
      existingAgg?.firstOrderAt && existingAgg.firstOrderAt < order.createdAt
        ? existingAgg.firstOrderAt
        : order.createdAt;

    await tx.customer.update({
      where: { id: input.customerId },
      data: {
        clvCents: { increment: totalCents },
        ordersCount: { increment: 1 },
        firstOrderAt: newFirstOrderAt,
      },
    });

    await tx.orderItem.createMany({
      data: normalizedItems.map((item) => {
        const product = item.productId ? productMap.get(item.productId) : null;
        const supplierId = item.supplierId;
        if (supplierId && !supplierSet.has(supplierId)) {
          throw new DomainError('supplier_mismatch', 400, {
            supplierId: item.supplierId,
            productId: item.productId,
          });
        }

        // Handle ad-hoc items: use input name/sku if product not found
        const name = product?.name ?? item.name;
        const sku = product?.sku ?? item.sku ?? 'CUSTOM';

        return {
          orderId: order.id,
          productId: product ? item.productId : null,
          sku,
          name,
          qty: item.qtyRequested || 0,
          priceCents: item.priceCents || 0,
          totalCents: (item.qtyRequested || 0) * (item.priceCents || 0),
          supplierId: item.supplierId as string | undefined,
          vatCategory: VatCategory.STANDARD, // Default VAT category for Israel
          taxRate: 0.18, // 18% VAT in Israel
          demo: isDemo(),
        };
      }),
    });

    // Build per-SKU demand from order items
    try {
      const decrements = new Map<string, number>(); // key: sku code, value: total qty
      for (const item of normalizedItems) {
        const product = item.productId ? productMap.get(item.productId) : null;
        // Use product SKU if available, otherwise check if item has a manual SKU
        const skuCode = product?.sku ?? item.sku;

        if (!skuCode) continue;
        decrements.set(skuCode, (decrements.get(skuCode) || 0) + (item.qtyRequested || 0));
      }

      // Check if procurement is needed (insufficient stock)
      let procurementNeeded = false;
      if (decrements.size > 0) {
        const skuCodes = Array.from(decrements.keys());
        const skuRows = await tx.product.findMany({
          where: { sku: { in: skuCodes }, isActive: true },
          select: { sku: true, stock: true },
        });
        const stockByCode = new Map(skuRows.map((r) => [r.sku, r.stock]));
        for (const [code, required] of decrements.entries()) {
          const available = stockByCode.get(code) ?? 0;
          if (required > available) {
            procurementNeeded = true;
            break;
          }
        }
      }

      // If insufficient stock – mark order as requiring purchase order (if enabled in settings)
      if (procurementNeeded && storeSettings.autoPurchaseOrder && order.status !== 'PO_CREATED') {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'PO_CREATED', updatedAt: new Date() },
        });

        await tx.statusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: 'TO_DO',
            toStatus: 'PO_CREATED',
            // Only set changedBy if it's a valid UUID to satisfy FK
            ...(createdById ? { changedBy: createdById } : {}),
            reason: 'Auto-set: insufficient stock, requires purchase order',
            metadata: { trigger: 'AUTO_PROCUREMENT_NEEDED' },
            demo: isDemo(),
          },
        });

        // Mark that we should auto-generate PO after transaction completes
        shouldGenerateAutoPO = true;
      }

      // Decrement SKU stock based on ordered quantities (sync inventory on order placement)
      for (const [skuCode, qty] of decrements.entries()) {
        // Find the Product by SKU code
        const skuRow = await tx.product.findFirst({
          where: { sku: skuCode },
          select: { id: true, stock: true, reorderLevel: true, isActive: true },
        });
        if (!skuRow || !skuRow.isActive) continue;

        // Atomic decrement and fetch the updated stock
        const updated = await tx.product.update({
          where: { id: skuRow.id },
          data: {
            stock: { decrement: qty },
            updatedAt: new Date(),
          },
          select: { id: true, stock: true, reorderLevel: true },
        });

        // Low stock alert (after decrement) — threshold is max(reorderLevel, settings.lowStockThreshold)
        try {
          const { ReceivingNotificationService } = await import('@/lib/receiving-notifications');
          await ReceivingNotificationService.notifyLowStockAlert(
            updated.id,
            updated.stock,
            Math.max(updated.reorderLevel || 0, storeSettings.lowStockThreshold || 0)
          );
        } catch (notifyErr) {
          console.warn('Low stock alert failed:', notifyErr);
        }
      }
    } catch (invErr) {
      // Do not fail order creation due to stock sync issues; log for observability
      console.warn('Inventory sync on order creation failed:', invErr);
    }

    if (paymentsInput.length > 0) {
      try {
        const normalizedPayments = paymentsInput.map((payment, idx) => ({
          ...payment,
          status: assertPaymentStatus(payment.status, `order:${order.id}:create:${idx}`),
        }));

        await tx.payment.createMany({
          data: normalizedPayments.map((payment) => ({
            orderId: order.id,
            method: payment.method,
            amountCents: payment.amountCents,
            status: payment.status,
            demo: isDemo(),
          })),
        });

        const now = new Date();
        const aggregates = summarizePayments(
          normalizedPayments.map((payment) => ({
            amountCents: payment.amountCents,
            status: payment.status,
            updatedAt: now,
          }))
        );

        order = await tx.order.update({
          where: { id: order.id },
          data: {
            paidAmountCents: aggregates.paidAmountCents,
            paymentStatus: aggregates.paymentStatus,
            lastPaymentAt: aggregates.lastPaymentAt,
          },
        });
      } catch (paymentError) {
        if (paymentError instanceof DomainError) {
          throw paymentError;
        }
        console.warn(
          `Unable to persist payment info for order ${order.id}; proceeding without payment tracking.`,
          paymentError
        );
      }
    }

    await writeOrderAuditEvent(tx, {
      orderId: order.id,
      actorId: createdById ?? null,
      action: 'ORDER_CREATED',
      payload: {
        entity: 'order',
        entityId: order.id,
      },
      diff: {
        before: null,
        after: {
          id: order.id,
          number: order.number,
          totalCents,
          itemCount: input.items.length,
        },
      },
    });

    await recordOrderCharge(tx, customer.id, order.id, totalCents, `חיוב הזמנה ${order.number}`);
    if (order.paidAmountCents > 0) {
      await recordOrderPayment(
        tx,
        customer.id,
        order.id,
        null,
        order.paidAmountCents,
        'תשלום שנגבה בעת יצירת ההזמנה'
      );
    }

    return order;
  });

  // Capture the result for use after transaction
  const createdOrder = await orderTransaction;

  // Auto-generate purchase orders if enabled and stock was insufficient
  if (shouldGenerateAutoPO && storeSettingsForAutoPO?.autoPurchaseOrder && createdOrder) {
    try {
      console.log(`[Auto-PO] Generating purchase orders for order ${createdOrder.id}`);

      const poResult = await PurchaseOrderService.generatePurchaseOrders({
        orderIds: [createdOrder.id],
        userId,
        notes: `נוצר אוטומטית עבור הזמנה ${createdOrder.number}`,
      });

      if (poResult.purchaseOrders.length > 0) {
        console.log(
          `[Auto-PO] Created ${poResult.purchaseOrders.length} purchase order(s) for order ${createdOrder.id}`
        );

        // Update order with purchase order references
        const poReferences = poResult.purchaseOrders.map((po) => po.reference).join(', ');
        await prisma.statusHistory.create({
          data: {
            orderId: createdOrder.id,
            fromStatus: 'PO_CREATED',
            toStatus: 'AWAITING_STOCK',
            changedBy: isValidUuid(userId) ? userId : undefined,
            reason: `הזמנות רכש נוצרו אוטומטית: ${poReferences}`,
            metadata: {
              trigger: 'AUTO_PO_GENERATED',
              purchaseOrderIds: poResult.purchaseOrders.map((po) => po.id),
            },
            demo: isDemo(),
          },
        });
      } else if (poResult.errors.length > 0) {
        console.warn(
          `[Auto-PO] Errors generating PO for order ${createdOrder.id}:`,
          poResult.errors
        );
      }
    } catch (poError) {
      // Don't fail order creation due to PO generation error
      console.error(
        `[Auto-PO] Failed to generate purchase orders for order ${createdOrder.id}:`,
        poError
      );
    }
  }

  // Trigger automation for new order creation (async, non-blocking)
  if (createdOrder) {
    OrderAutomationService.onOrderCreated(createdOrder.id, createdOrder.status, userId).catch(
      (error) => {
        console.error(`[Order] Automation hook failed for order ${createdOrder.id}:`, error);
      }
    );
  }

  return createdOrder;
}

export type PaymentSummaryUpdatePayload = {
  paidAmountCents?: number;
  paymentStatus?: PaymentStatus;
  lastPaymentAt?: Date | string | null;
};

export async function upsertOrderPayment(
  orderId: string,
  paymentInput: OrderPaymentInput,
  userId?: string
) {
  if (!orderId) {
    throw new DomainError('missing_order_id', 400);
  }

  const actorId = userId && isValidUuid(userId) ? userId : undefined;

  const result = await prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      throw new DomainError('order_not_found', 404, { orderId });
    }

    const currentPayment = await tx.payment.findFirst({
      where: { orderId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!paymentInput.method.trim()) {
      throw new DomainError('payment_method_required', 400, { orderId });
    }

    const method = assertPaymentMethod(paymentInput.method, `order:${orderId}:payment:method`);

    const paymentData: {
      method: PaymentMethod;
      amountCents: number;
      status: PaymentStatus;
    } = {
      method,
      amountCents: paymentInput.amountCents,
      status: assertPaymentStatus(paymentInput.status, `order:${orderId}:payment:upsert`),
    };

    const paymentRecord = currentPayment
      ? await tx.payment.update({
          where: { id: currentPayment.id },
          data: paymentData,
        })
      : await tx.payment.create({
          data: {
            ...paymentData,
            orderId,
            demo: isDemo(),
          },
        });

    const payments = await tx.payment.findMany({
      where: { orderId },
      orderBy: { updatedAt: 'desc' },
    });

    const aggregates = summarizePayments(
      payments.map((payment) => ({
        amountCents: payment.amountCents,
        status: payment.status,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      }))
    );

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        paidAmountCents: aggregates.paidAmountCents,
        paymentStatus: aggregates.paymentStatus,
        lastPaymentAt: aggregates.lastPaymentAt,
      },
    });

    await writeOrderAuditEvent(tx, {
      orderId,
      actorId: actorId ?? null,
      action: 'ORDER_PAYMENT_UPDATED',
      payload: {
        entity: 'order',
        entityId: orderId,
      },
      diff: {
        before: {
          paidAmountCents: existingOrder.paidAmountCents,
          paymentStatus: existingOrder.paymentStatus,
          lastPaymentAt: existingOrder.lastPaymentAt,
        },
        after: {
          paidAmountCents: updatedOrder.paidAmountCents,
          paymentStatus: updatedOrder.paymentStatus,
          lastPaymentAt: updatedOrder.lastPaymentAt,
          payment: {
            id: paymentRecord.id,
            method: paymentRecord.method,
            status: paymentRecord.status,
            amountCents: paymentRecord.amountCents,
          },
        },
      },
    });

    const paidDelta = updatedOrder.paidAmountCents - existingOrder.paidAmountCents;
    if (paidDelta > 0) {
      await recordOrderPayment(
        tx,
        existingOrder.customerId,
        orderId,
        paymentRecord.id,
        paidDelta,
        `תשלום עודכן (${paymentRecord.method})`
      );
    } else if (paidDelta < 0) {
      await recordOrderAdjustment(
        tx,
        existingOrder.customerId,
        orderId,
        Math.abs(paidDelta),
        'יתרת תשלום הוגדלה'
      );
    }

    return { order: updatedOrder, payment: paymentRecord, payments, paidDelta };
  });

  if (result.paidDelta > 0) {
    void import('@/lib/push/webPush')
      .then(({ notifyPaymentReceivedWebPush }) =>
        notifyPaymentReceivedWebPush({
          orderId: result.order.id,
          orderNumber: result.order.number,
          amountCents: result.paidDelta,
        })
      )
      .catch(() => undefined);
  }

  return result;
}

export async function updateOrderPaymentSummary(
  orderId: string,
  payload: PaymentSummaryUpdatePayload
) {
  if (!orderId) {
    throw new DomainError('missing_order_id', 400);
  }

  const updatePayload: Record<string, unknown> = {};

  if (payload.paidAmountCents !== undefined) {
    updatePayload.paidAmountCents = Math.max(0, payload.paidAmountCents);
  }
  if (payload.paymentStatus !== undefined) {
    updatePayload.paymentStatus = assertPaymentStatus(
      payload.paymentStatus,
      `order:${orderId}:payment:summary`
    );
  }
  if (payload.lastPaymentAt !== undefined) {
    updatePayload.lastPaymentAt =
      payload.lastPaymentAt instanceof Date
        ? payload.lastPaymentAt
        : payload.lastPaymentAt
          ? new Date(payload.lastPaymentAt)
          : null;
  }

  return prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, number: true, paidAmountCents: true },
    });

    if (!existingOrder) {
      throw new DomainError('order_not_found', 404, { orderId });
    }

    if (Object.keys(updatePayload).length === 0) {
      return existingOrder;
    }

    try {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updatePayload,
      });

      const paidDelta = updatedOrder.paidAmountCents - existingOrder.paidAmountCents;
      if (paidDelta > 0) {
        await recordOrderPayment(
          tx,
          existingOrder.customerId,
          orderId,
          null,
          paidDelta,
          'תשלום עודכן ידנית'
        );
      } else if (paidDelta < 0) {
        await recordOrderAdjustment(
          tx,
          existingOrder.customerId,
          orderId,
          Math.abs(paidDelta),
          'יתרה גדלה ידנית'
        );
      }

      return updatedOrder;
    } catch (error) {
      const prismaErrorCode = (error as any)?.code;
      if (prismaErrorCode === 'P2025') {
        throw new DomainError('order_not_found', 404, { orderId });
      }
      throw error;
    }
  });
}

/**
 * Updates the delivery assignment for an order.
 */
export async function updateDeliveryAssignment(
  orderId: string,
  deliveryAssignedToId: string | null,
  userId: string
) {
  if (!orderId) throw new DomainError('missing_order_id', 400);

  // Validation: Ensure the assigned user exists if not null
  if (deliveryAssignedToId) {
    const assignedUser = await prisma.user.findUnique({ where: { id: deliveryAssignedToId } });
    if (!assignedUser) {
      throw new DomainError('user_not_found', 404, { userId: deliveryAssignedToId });
    }
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { assignedUserId: deliveryAssignedToId },
  });

  await writeOrderAuditEvent(prisma as unknown as AuditEventClient, {
    orderId,
    actorId: userId,
    action: 'ORDER_DELIVERY_ASSIGNED',
    payload: {
      entity: 'order',
      entityId: orderId,
    },
    diff: {
      before: null,
      after: { deliveryAssignedToId },
    },
  });

  return order;
}

/**
 * Updates the allocation status of an order item.
 */
export async function updateItemAllocation(
  orderId: string,
  itemId: string,
  status: AllocationStatusValue,
  userId: string,
  options: ItemAllocationMutationOptions = {}
) {
  const result = await updateItemsAllocationBatch(
    orderId,
    [{ itemId, status, supplierId: options.supplierId }],
    userId,
    options
  );
  return result.items[0];
}

export async function updateItemsAllocationBatch(
  orderId: string,
  updates: ItemAllocationUpdateInput[],
  userId: string,
  options: ItemAllocationMutationOptions = {}
): Promise<{ items: OrderItem[]; count: number }> {
  if (updates.length === 0) {
    throw new DomainError('empty_batch', 400, { message: 'No item updates provided' });
  }

  const sanitizedUpdates = updates.map((update) => ({
    itemId: update.itemId,
    status: update.status,
    supplierId: update.supplierId,
  }));

  const uniqueItemIds = Array.from(new Set(sanitizedUpdates.map((update) => update.itemId)));

  const updatedItems = await prisma.$transaction(async (tx) => {
    await acquireOrderMutationLock(tx, orderId);
    await assertOrderVersion(tx, orderId, options.expectedUpdatedAt ?? null);

    const existingItems = await tx.orderItem.findMany({
      where: {
        orderId,
        id: { in: uniqueItemIds },
      },
      select: {
        id: true,
        sku: true,
        allocationStatus: true,
        supplierId: true,
      },
    });

    if (existingItems.length !== uniqueItemIds.length) {
      const existingIds = new Set(existingItems.map((item) => item.id));
      const missingItemIds = uniqueItemIds.filter((itemId) => !existingIds.has(itemId));
      throw new DomainError('item_not_found', 404, { orderId, missingItemIds });
    }

    const supplierIds = Array.from(
      new Set(
        sanitizedUpdates
          .map((update) => update.supplierId)
          .filter((supplierId): supplierId is string => Boolean(supplierId))
      )
    );

    if (supplierIds.length > 0) {
      const existingSuppliers = await tx.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true },
      });
      const existingSupplierIds = new Set(existingSuppliers.map((supplier) => supplier.id));
      const missingSupplierIds = supplierIds.filter(
        (supplierId) => !existingSupplierIds.has(supplierId)
      );
      if (missingSupplierIds.length > 0) {
        throw new DomainError('supplier_not_found', 404, { orderId, missingSupplierIds });
      }
    }

    const beforeById = new Map(
      existingItems.map((item) => [
        item.id,
        {
          allocationStatus: item.allocationStatus,
          supplierId: item.supplierId,
        },
      ])
    );

    const batchUpdatedItems: Awaited<ReturnType<typeof tx.orderItem.update>>[] = [];
    for (const update of sanitizedUpdates) {
      const updateData: Prisma.OrderItemUncheckedUpdateInput = {
        allocationStatus: update.status,
      };
      if (update.supplierId !== undefined) {
        updateData.supplierId = update.supplierId;
      }

      const beforeState = beforeById.get(update.itemId);
      const updated = await tx.orderItem.update({
        where: { id: update.itemId },
        data: updateData,
      });

      batchUpdatedItems.push(updated);

      await writeOrderAuditEvent(tx, {
        orderId,
        actorId: userId,
        action: 'ORDER_ITEM_ALLOCATION_UPDATED',
        payload: {
          entity: 'order_item',
          entityId: update.itemId,
        },
        diff: {
          before: {
            allocationStatus: beforeState?.allocationStatus ?? null,
            supplierId: beforeState?.supplierId ?? null,
          },
          after: {
            allocationStatus: update.status,
            supplierId: update.supplierId ?? beforeState?.supplierId ?? null,
          },
        },
        meta: {
          orderId,
          mode: 'batch',
        },
      });
    }

    return batchUpdatedItems;
  });

  await syncOrderOperationalState(orderId, {
    actorId: userId,
    reason:
      updatedItems.length === 1
        ? `עדכון הקצאת פריט ${updatedItems[0]?.sku ?? ''}`.trim()
        : `עדכון הקצאה מרוכז (${updatedItems.length} פריטים)`,
  });
  await invalidateOrderReadModels(orderId);

  return {
    items: updatedItems,
    count: updatedItems.length,
  };
}

/**
 * Adds a manual payment to an order.
 */
export async function addManualPayment(
  orderId: string,
  paymentInput: OrderPaymentInput,
  userId: string,
  notes?: string
) {
  if (!orderId) throw new DomainError('missing_order_id', 400);

  const payment = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new DomainError('order_not_found', 404, { orderId });

    const newPayment = await tx.payment.create({
      data: {
        orderId,
        method: assertPaymentMethod(paymentInput.method, `order:${orderId}:manual:method`),
        amountCents: paymentInput.amountCents,
        status: assertPaymentStatus(
          paymentInput.status ?? PaymentStatus.PAID,
          `order:${orderId}:manual:status`
        ),
        notes,
        processedBy: isValidUuid(userId) ? userId : undefined,
        demo: isDemo(),
      },
    });

    // Update Order Aggregates
    const payments = await tx.payment.findMany({ where: { orderId } });
    const aggs = summarizePayments(
      payments.map((p) => ({
        amountCents: p.amountCents,
        status: p.status,
        updatedAt: p.updatedAt,
      }))
    );

    await tx.order.update({
      where: { id: orderId },
      data: {
        paidAmountCents: aggs.paidAmountCents,
        paymentStatus: aggs.paymentStatus,
        lastPaymentAt: aggs.lastPaymentAt,
      },
    });

    // Ledger
    await recordOrderPayment(
      tx,
      order.customerId,
      orderId,
      newPayment.id,
      paymentInput.amountCents,
      `תשלום ידני: ${paymentInput.method}`
    );

    return newPayment;
  });

  return payment;
}
