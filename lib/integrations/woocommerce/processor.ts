import type { Prisma, WooIntegration } from '@prisma/client';
import { IntakeError, splitAddress, storeProductSchema, transformOrder } from './transform';

export async function processOrder(
  tx: Prisma.TransactionClient,
  integration: WooIntegration,
  payload: unknown
) {
  const data = transformOrder(payload);
  const o = data.source;
  const externalId = String(o.id);
  const scope = integration.tenantId + ':' + integration.id;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope + ':order:' + externalId}, 0))::text`;
  const existing = await tx.order.findFirst({ where: { wooOrderId: externalId } });
  if (existing && existing.wooIntegrationId !== integration.id)
    throw new IntakeError('SOURCE_CONFLICT');
  if (existing?.sourceModifiedAt && existing.sourceModifiedAt >= o.date_modified_gmt)
    return existing.id;

  // Woo guest checkout has customer_id=0: scope that identity to the order, never email or phone.
  const customerKey = o.customer_id ? String(o.customer_id) : `guest-order:${externalId}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope + ':customer:' + customerKey}, 0))::text`;
  let customer = await tx.customer.findFirst({
    where: { wooIntegrationId: integration.id, wooCustomerId: customerKey },
  });
  if (!customer)
    customer = await tx.customer.create({
      data: {
        name: data.customerName,
        phone: o.billing.phone,
        email: o.billing.email || null,
        wooIntegrationId: integration.id,
        wooCustomerId: customerKey,
      },
    });

  const commerce = {
    wooIntegrationId: integration.id,
    wooOrderId: externalId,
    channel: 'WOOCOMMERCE' as const,
    subTotalCents: data.subTotalCents,
    taxCents: o.total_tax,
    discountCents: o.discount_total,
    shippingCents: o.shipping_total,
    totalCents: o.total,
    currency: o.currency,
    customerName: data.customerName,
    customerPhone: o.billing.phone,
    customerEmail: o.billing.email || null,
    paidAmountCents: data.paidAmountCents,
    paymentStatus: data.paymentStatus,
    lastPaymentAt: o.date_paid_gmt,
    sourceStatus: o.status,
    sourceModifiedAt: o.date_modified_gmt,
    sourceReviewReason: data.review,
    sourceShipping: data.shipping,
  };
  let order = existing;
  if (!order) {
    const billing = await tx.address.create({
      data: { customerId: customer.id, type: 'BILLING', ...splitAddress(o.billing) },
    });
    const shipping = await tx.address.create({
      data: { customerId: customer.id, type: 'SHIPPING', ...data.shipping },
    });
    order = await tx.order.create({
      data: {
        ...commerce,
        number: `WOO-${integration.id.slice(0, 8)}-${externalId}`,
        status: 'RECEIVED',
        customerId: customer.id,
        billingAddressId: billing.id,
        shippingAddressId: shipping.id,
        city: data.shipping.city,
        addressLine: o.shipping.address_1,
        createdByUserId: null,
      },
    });
    await tx.statusHistory.create({
      data: {
        orderId: order.id,
        toStatus: 'RECEIVED',
        changedBy: integration.serviceUserId,
        reason: 'נקלטה הזמנה מהחנות',
      },
    });
  } else {
    await tx.order.update({ where: { id: order.id }, data: commerce });
    if (!order.addressOverridden) {
      await tx.address.update({ where: { id: order.shippingAddressId }, data: data.shipping });
      await tx.order.update({
        where: { id: order.id },
        data: { city: data.shipping.city, addressLine: o.shipping.address_1 },
      });
    }
  }
  const liveIds = o.line_items.map((l) => String(l.id));
  // Keep local readiness, allocation, supplier notes and scheduling on retained lines.
  await tx.orderItem.deleteMany({ where: { orderId: order.id, wooLineId: { notIn: liveIds } } });
  for (const l of o.line_items) {
    const product = await tx.product.findFirst({
      where: { wooIntegrationId: integration.id, wooId: l.variation_id || l.product_id },
    });
    const prior = await tx.orderItem.findFirst({
      where: { orderId: order.id, wooLineId: String(l.id) },
    });
    const item = {
      name: l.name,
      sku: l.sku,
      qty: l.quantity,
      priceCents: Math.round(l.total / l.quantity),
      totalCents: l.total,
      wooProductId: String(l.product_id),
      wooVariationId: l.variation_id ? String(l.variation_id) : null,
      productId: product?.id ?? null,
    };
    if (prior)
      await tx.orderItem.update({
        where: { id: prior.id },
        data: {
          ...item,
          ...(prior.qty !== l.quantity ||
          prior.wooProductId !== item.wooProductId ||
          prior.wooVariationId !== item.wooVariationId
            ? { received: false, receivedQuantity: 0, allocationStatus: 'PENDING' as const }
            : {}),
        },
      });
    else
      await tx.orderItem.create({
        data: { ...item, orderId: order.id, wooLineId: String(l.id), vatCategory: 'STANDARD' },
      });
  }
  await tx.orderLog.create({
    data: {
      orderId: order.id,
      action: 'WOO_SYNC',
      metadata: { sourceVersion: o.date_modified_gmt.toISOString(), review: data.review },
    },
  });
  await tx.inboundOrder.updateMany({
    where: { source: 'WOOCOMMERCE', sourceOrderId: externalId },
    data: {
      orderId: order.id,
      status: data.review ? 'CHANGES_REQUIRED' : 'IMPORTED',
      failureReason: data.review,
    },
  });
  return order.id;
}

export async function processProduct(
  tx: Prisma.TransactionClient,
  integration: WooIntegration,
  payload: unknown
) {
  const parsed = storeProductSchema.safeParse(payload);
  if (!parsed.success) throw new IntakeError('INVALID_PRODUCT_DATA');
  const p = parsed.data;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${integration.tenantId + ':product:' + p.id}, 0))::text`;
  const existing = await tx.product.findFirst({ where: { OR: [{ wooId: p.id }, { sku: p.sku }] } });
  if (existing && (existing.wooIntegrationId !== integration.id || existing.wooId !== p.id))
    throw new IntakeError('SKU_SOURCE_CONFLICT');
  if (existing?.sourceModifiedAt && existing.sourceModifiedAt >= p.date_modified_gmt) return;
  const data = {
    name: p.name,
    type: p.type === 'variable' ? ('VARIABLE' as const) : ('SIMPLE' as const),
    sku: p.sku,
    basePriceCents: p.price,
    wooId: p.id,
    wooIntegrationId: integration.id,
    sourceModifiedAt: p.date_modified_gmt,
    is_available: p.stock_status === 'instock',
    stock: p.stock_quantity ?? 0,
  };
  const product = existing
    ? await tx.product.update({ where: { id: existing.id }, data })
    : await tx.product.create({ data });
  await tx.orderItem.updateMany({
    where: {
      productId: null,
      order: { wooIntegrationId: integration.id },
      ...(p.type === 'variation'
        ? { wooVariationId: String(p.id) }
        : { wooProductId: String(p.id), wooVariationId: null }),
    },
    data: { productId: product.id },
  });
}
