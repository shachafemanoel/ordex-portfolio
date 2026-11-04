import { AddressType, Prisma, VatCategory, type OrderStatus } from '@prisma/client';
import { OrderStatusManager } from '@/lib/business-logic';
import { prisma } from '@/lib/db';
import { autoGeocodeNewOrder } from '@/lib/geocodingService';
import {
  ORDER_WITH_RELATIONS_INCLUDE,
  serializeOrder,
  type OrderWithRelations,
} from '../serializers/orderSerializer';
import type { Order } from '@/lib/types';
import type { OrderFormData } from '@/lib/validation';

interface ManualOrderItemNormalized {
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
}

interface ManualOrderInputNormalized {
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  billingAddress: {
    city: string;
    street: string;
    number: string;
    floor?: string | null;
    notes?: string | null;
  };
  shippingAddress: {
    city: string;
    street: string;
    number: string;
    floor?: string | null;
    notes?: string | null;
  };
  items: ManualOrderItemNormalized[];
  currency: string;
  notesInternal?: string;
  shippingCost?: number;
  discount?: number;
}

function normalizeManualOrderInput(data: OrderFormData): ManualOrderInputNormalized {
  if ('customer' in data) {
    return {
      customer: {
        name: data.customer.name.trim(),
        email: data.customer.email?.trim() || undefined,
        phone: data.customer.phone?.trim() || undefined,
      },
      billingAddress: {
        city: data.billingAddress.city.trim(),
        street: data.billingAddress.street.trim(),
        number: data.billingAddress.number.trim(),
        floor: data.billingAddress.floor?.trim() || null,
        notes: data.billingAddress.notes?.trim() || null,
      },
      shippingAddress: {
        city: data.shippingAddress.city.trim(),
        street: data.shippingAddress.street.trim(),
        number: data.shippingAddress.number.trim(),
        floor: data.shippingAddress.floor?.trim() || null,
        notes: data.shippingAddress.notes?.trim() || null,
      },
      items: data.items.map((item) => ({
        sku: item.sku?.trim() || undefined,
        name: item.name.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
      })),
      currency: data.currency || 'ILS',
      notesInternal: data.notesInternal?.trim() || undefined,
      shippingCost: data.shippingCost,
      discount: data.discount,
    };
  }

  const totalQty = data.items.reduce((sum, item) => sum + item.qty, 0) || 1;
  const unitPrice = data.totalAmount / totalQty;

  return {
    customer: {
      name: data.customerName.trim(),
      email: data.customerEmail?.trim() || undefined,
      phone: data.customerPhone?.trim() || undefined,
    },
    billingAddress: {
      city: (data.city || 'לא צויין').trim(),
      street: data.address.trim(),
      number: (data.houseNumber || '1').trim(),
      floor: data.floor?.trim() || null,
      notes: data.note?.trim() || null,
    },
    shippingAddress: {
      city: (data.city || 'לא צויין').trim(),
      street: data.address.trim(),
      number: (data.houseNumber || '1').trim(),
      floor: data.floor?.trim() || null,
      notes: data.note?.trim() || null,
    },
    items: data.items.map((item, idx) => ({
      sku: item.productId?.trim() || undefined,
      name: item.productId?.trim() || `פריט ${idx + 1}`,
      quantity: item.qty,
      unitPrice,
    })),
    currency: 'ILS',
    notesInternal: data.note?.trim() || undefined,
    shippingCost: undefined,
    discount: undefined,
  };
}

async function generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const lastOrder = await tx.order.findFirst({
    where: { number: { startsWith: 'ORD-' } },
    orderBy: { createdAt: 'desc' },
  });

  const match = lastOrder?.number?.match(/ORD-(\d+)/);
  if (match) {
    const next = Number.parseInt(match[1], 10) + 1;
    return `ORD-${String(next).padStart(5, '0')}`;
  }

  const fallback = Math.floor(Date.now() / 1000);
  return `ORD-${fallback}`;
}

async function getOrCreateProduct(tx: Prisma.TransactionClient, item: ManualOrderItemNormalized) {
  const skuCandidate = item.sku?.trim();
  if (skuCandidate) {
    const existing = await tx.product.findFirst({ where: { sku: skuCandidate } });
    if (existing) return existing;
  }

  const generatedSku =
    skuCandidate && skuCandidate.length > 0
      ? skuCandidate
      : `AUTO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  return tx.product.create({
    data: {
      sku: generatedSku,
      name: item.name,
    },
  });
}

function calculateTotals(input: ManualOrderInputNormalized) {
  const subtotalCents = input.items.reduce((sum, item) => {
    const unitCents = Math.round(item.unitPrice * 100);
    return sum + unitCents * item.quantity;
  }, 0);

  const shippingCents = Math.round((input.shippingCost ?? 0) * 100);
  const discountCents = Math.round((input.discount ?? 0) * 100);
  const taxCents = 0; // Manual orders currently do not capture tax breakdown
  const totalCents = subtotalCents + taxCents + shippingCents - discountCents;

  return { subtotalCents, taxCents, shippingCents, discountCents, totalCents };
}

async function fetchOrderWithRelations(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<OrderWithRelations> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: ORDER_WITH_RELATIONS_INCLUDE,
  });

  if (!order) {
    throw new Error('Order not found after persistence');
  }

  return order;
}

export async function createManualOrder(
  data: OrderFormData,
  _options: { userId?: string } = {}
): Promise<{ order: OrderWithRelations; serialized: Order }> {
  const normalized = normalizeManualOrderInput(data);

  const result = await prisma.$transaction(async (tx) => {
    const { subtotalCents, taxCents, shippingCents, discountCents, totalCents } =
      calculateTotals(normalized);

    const customer = await tx.customer.create({
      data: {
        name: normalized.customer.name,
        email: normalized.customer.email,
        phone: normalized.customer.phone,
      },
    });

    const billingAddress = await tx.address.create({
      data: {
        customerId: customer.id,
        type: AddressType.BILLING,
        city: normalized.billingAddress.city,
        street: normalized.billingAddress.street,
        number: normalized.billingAddress.number,
        floor: normalized.billingAddress.floor,
        notes: normalized.billingAddress.notes,
      },
    });

    const shippingAddress = await tx.address.create({
      data: {
        customerId: customer.id,
        type: AddressType.SHIPPING,
        city: normalized.shippingAddress.city,
        street: normalized.shippingAddress.street,
        number: normalized.shippingAddress.number,
        floor: normalized.shippingAddress.floor,
        notes: normalized.shippingAddress.notes,
      },
    });

    const orderNumber = await generateOrderNumber(tx);

    const shippingLine = `${normalized.shippingAddress.street} ${normalized.shippingAddress.number}, ${normalized.shippingAddress.city}`;

    const orderRecord = await tx.order.create({
      data: {
        number: orderNumber,
        status: 'TO_DO',
        customerId: customer.id,
        billingAddressId: billingAddress.id,
        shippingAddressId: shippingAddress.id,
        currency: normalized.currency,
        subTotalCents: subtotalCents,
        taxCents,
        shippingCents,
        discountCents,
        totalCents,
        notesInternal: normalized.notesInternal,
        city: normalized.shippingAddress.city,
        addressLine: shippingLine,
      },
    });

    for (const item of normalized.items) {
      const product = await getOrCreateProduct(tx, item);
      const priceCents = Math.round(item.unitPrice * 100);

      await tx.orderItem.create({
        data: {
          orderId: orderRecord.id,
          productId: product.id,
          sku: product.sku,
          name: item.name,
          qty: item.quantity,
          priceCents,
          totalCents: priceCents * item.quantity,
          vatCategory: VatCategory.STANDARD,
          taxRate: item.vatRate !== undefined ? new Prisma.Decimal(item.vatRate) : null,
        },
      });
    }

    const persisted = await fetchOrderWithRelations(tx, orderRecord.id);
    return { order: persisted, serialized: serializeOrder(persisted) };
  });

  void autoGeocodeNewOrder(result.order.id);
  return result;
}

export async function updateManualOrder(
  orderId: string,
  data: OrderFormData,
  options: { status?: OrderStatus; userId?: string; reason?: string } = {}
): Promise<{ order: OrderWithRelations; serialized: Order }> {
  const normalized = normalizeManualOrderInput(data);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        billingAddress: true,
        shippingAddress: true,
        items: true,
      },
    });

    if (!existing) {
      throw new Error('Order not found');
    }

    const { subtotalCents, taxCents, shippingCents, discountCents, totalCents } =
      calculateTotals(normalized);

    await tx.customer.update({
      where: { id: existing.customerId },
      data: {
        name: normalized.customer.name,
        email: normalized.customer.email,
        phone: normalized.customer.phone,
      },
    });

    await tx.address.update({
      where: { id: existing.billingAddressId },
      data: {
        city: normalized.billingAddress.city,
        street: normalized.billingAddress.street,
        number: normalized.billingAddress.number,
        floor: normalized.billingAddress.floor,
        notes: normalized.billingAddress.notes,
      },
    });

    await tx.address.update({
      where: { id: existing.shippingAddressId },
      data: {
        city: normalized.shippingAddress.city,
        street: normalized.shippingAddress.street,
        number: normalized.shippingAddress.number,
        floor: normalized.shippingAddress.floor,
        notes: normalized.shippingAddress.notes,
      },
    });

    await tx.orderItem.deleteMany({ where: { orderId } });

    for (const item of normalized.items) {
      const product = await getOrCreateProduct(tx, item);
      const priceCents = Math.round(item.unitPrice * 100);

      await tx.orderItem.create({
        data: {
          orderId,
          productId: product.id,
          sku: product.sku,
          name: item.name,
          qty: item.quantity,
          priceCents,
          totalCents: priceCents * item.quantity,
          vatCategory: VatCategory.STANDARD,
          taxRate: item.vatRate !== undefined ? new Prisma.Decimal(item.vatRate) : null,
        },
      });
    }

    const shippingLine = `${normalized.shippingAddress.street} ${normalized.shippingAddress.number}, ${normalized.shippingAddress.city}`;

    await tx.order.update({
      where: { id: orderId },
      data: {
        // Status changes are handled via OrderStatusManager to ensure history and side-effects
        subTotalCents: subtotalCents,
        taxCents,
        shippingCents,
        discountCents,
        totalCents,
        notesInternal: normalized.notesInternal,
        city: normalized.shippingAddress.city,
        addressLine: shippingLine,
        lat: null,
        lng: null,
      },
    });

    const persisted = await fetchOrderWithRelations(tx, orderId);
    return { order: persisted, serialized: serializeOrder(persisted) };
  });

  // Apply status transition via business logic service to ensure StatusHistoryEntry + side effects
  if (options.status && result.order.status !== options.status) {
    try {
      const change = await OrderStatusManager.changeOrderStatus({
        orderId,
        newStatus: options.status,
        reason: options.reason || 'Generic order update',
        userId: options.userId || 'SYSTEM',
      });
      // Prefer the serialized order from status change
      return { order: result.order, serialized: change.order };
    } catch (e) {
      // If transition fails, return the base update; let caller handle validation error upstream
      return result;
    }
  }

  void autoGeocodeNewOrder(orderId);
  return result;
}
