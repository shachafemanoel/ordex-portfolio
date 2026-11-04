import type { AddressSummary, OrderDTO } from '@/domain/orders/orderDTO';
import { normalizePayments } from '@/domain/payments/normalizePayment';
import { getStatusLabel, getTransitionTargets } from '@/lib/orderStatus';
import type { OrderEntity } from '@/lib/repositories/orders/OrdersRepository';
import { getOrderState } from '@/lib/services/orderState';
import { getStatusProgress as getStatusProgressFromMachine } from '@/lib/status-machine';
import { getNextActions, getWorkflowStageDescription } from '@/lib/workflow-requirements';
import { deriveOrderTask } from '@/src/server/services/ops-triggers.service';
import { OrderStatus } from '@prisma/client';

const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
  INSTALLING_NOW: OrderStatus.SCHEDULED,
};

function getStatusProgress(status: OrderStatus): number {
  return getStatusProgressFromMachine(status);
}

function calculateNextAllowedStatuses(status: OrderStatus): OrderStatus[] {
  return getTransitionTargets(status);
}

function formatAddress(address: any): string {
  if (!address) return '';

  const parts: string[] = [];

  if (address.street) parts.push(address.street);
  if (address.number) parts.push(address.number);
  if (address.floor) parts.push(`קומה ${address.floor}`);
  if (address.apartment) parts.push(`דירה ${address.apartment}`);
  if (address.city) parts.push(address.city);

  return parts.join(', ');
}

function calculateCreditStatus(customer: any): 'GOOD' | 'WARNING' | 'BLOCKED' {
  // Simple credit status calculation based on customer data
  // Can be enhanced with more sophisticated logic

  if (!customer) return 'GOOD';

  // Check if customer has unpaid orders or overdue payments
  const clvCents = customer.clvCents || 0;
  const ordersCount = customer.ordersCount || 0;

  // If customer has negative CLV, they might be blocked
  if (clvCents < -100000) return 'BLOCKED'; // -1000 ILS

  // If customer has negative CLV but not too bad, warning
  if (clvCents < 0) return 'WARNING';

  // If customer has many orders but low CLV, warning
  if (ordersCount > 10 && clvCents < 50000) return 'WARNING'; // 500 ILS

  return 'GOOD';
}

function normalizeAddress(address: any): AddressSummary {
  return {
    id: address.id,
    type: address.type,
    city: address.city,
    street: address.street,
    number: address.number,
    floor: address.floor,
    apartment: address.apartment,
    fullAddress: formatAddress(address),
    coordinates:
      typeof address.lat === 'number' && typeof address.lng === 'number'
        ? { lat: address.lat, lng: address.lng }
        : null,
    lat: address.lat,
    lng: address.lng,
    notes: address.notes,
  };
}

function calculateIsOverdue(order: any): boolean {
  // Simple overdue calculation
  // An order is overdue if it's in a pending status for more than 30 days

  if (!order || !order.updatedAt) return false;

  // Terminal statuses are never overdue
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return false;

  const now = new Date();
  const updatedAt = new Date(order.updatedAt);
  const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

  // Orders stuck for more than 30 days are overdue
  return daysSinceUpdate > 30;
}

function calculateDaysInStatus(order: any): number {
  if (!order || !order.updatedAt) return 0;

  const now = new Date();
  const updatedAt = new Date(order.updatedAt);
  const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

  return daysSinceUpdate;
}

function coerceDate(value: any): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapLegacyStatus(status: any): OrderStatus {
  if (!status) return OrderStatus.DRAFT;
  const asString = typeof status === 'string' ? status.toUpperCase() : status;
  return LEGACY_STATUS_MAP[asString as keyof typeof LEGACY_STATUS_MAP] ?? (asString as OrderStatus);
}

function coerceNumber(value: any, fallback = 0): number {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function generateItemSummary(items: any[]): string {
  if (!items || items.length === 0) {
    return 'אין פריטים';
  }

  const uniqueItems = new Map<string, number>();
  for (const item of items) {
    const name = item.name || item.sku || 'פריט לא ידוע';
    const quantity = coerceNumber(
      item.qty ?? item.quantity ?? item.quantityOrdered ?? item.qtyOrdered,
      0
    );
    uniqueItems.set(name, (uniqueItems.get(name) || 0) + (quantity > 0 ? quantity : 1));
  }

  const summaryParts: string[] = [];
  for (const [name, quantity] of uniqueItems.entries()) {
    summaryParts.push(`${name} (x${quantity})`);
  }

  if (summaryParts.length === 1) {
    return summaryParts[0];
  } else if (summaryParts.length > 1) {
    return `${summaryParts.length} פריטים שונים: ${summaryParts.join(', ')}`;
  }

  return 'אין פריטים';
}

function normalizeOrderItem(item: any) {
  const quantity = coerceNumber(
    item.qty ?? item.quantity ?? item.quantityOrdered ?? item.qtyOrdered,
    0
  );
  const unitPriceCents =
    coerceNumber(
      item.priceCents ??
        item.unitPriceCents ??
        item.unitPrice ??
        item.price ??
        item.unit_price ??
        0,
      0
    ) * (item.priceCents || item.unitPriceCents ? 1 : 100);
  const totalCents =
    (item.totalCents ??
      item.total_cents ??
      coerceNumber(item.total, 0) * (item.totalCents || item.total_cents ? 1 : 100)) ||
    unitPriceCents * quantity;

  return {
    id: item.id,
    orderId: item.orderId ?? item.order_id,
    productId: item.productId ?? item.product_id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    quantity,
    pricePerUnit: unitPriceCents / 100, // Convert cents to shekels
    total: totalCents / 100, // Convert cents to shekels
    received: item.received ?? false,
    receivedQuantity: coerceNumber(item.receivedQuantity ?? item.received_qty, 0),
    allocationStatus: item.allocationStatus ?? 'PENDING',
    supplierId: item.supplierId ?? item.supplier_id,
    supplier: item.supplier
      ? {
          id: item.supplier.id,
          name: item.supplier.name,
        }
      : null,
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          imageUrl: item.product.imageUrl ?? null,
        }
      : null,
  };
}

export function normalizeOrder(order: OrderEntity): OrderDTO {
  const primaryItems = Array.isArray((order as any)?.items) ? (order as any).items : [];
  const legacyItems = Array.isArray((order as any)?.lineItems)
    ? (order as any).lineItems.map((item: any) => ({
        ...item,
        qty: item.qty ?? item.quantity ?? item.qtyOrdered,
        priceCents:
          item.priceCents ??
          item.unitPriceCents ??
          (typeof item.price === 'number' ? Math.round(item.price * 100) : undefined),
        totalCents:
          item.totalCents ??
          (typeof item.price === 'number' && item.quantity
            ? Math.round(item.price * item.quantity * 100)
            : undefined),
      }))
    : [];
  const items = primaryItems.length > 0 ? primaryItems : legacyItems;
  const itemsCount =
    typeof (order as any)?._count?.items === 'number' ? (order as any)._count.items : items.length;

  const state = getOrderState(order as any);
  const status = mapLegacyStatus(order.status);

  const subTotalCents = coerceNumber(
    (order as any).subTotalCents ?? (order as any).subtotalCents,
    0
  );
  const taxCents = coerceNumber((order as any).taxCents, 0);
  const shippingCents = coerceNumber((order as any).shippingCents, 0);
  const discountCents = coerceNumber((order as any).discountCents, 0);
  const totalCents =
    coerceNumber((order as any).totalCents ?? (order as any).total_cents, 0) ||
    items.reduce((sum: number, item: any) => sum + (item.totalCents ?? 0), 0);
  const paidAmountCents = coerceNumber((order as any).paidAmountCents, 0);

  const dto: OrderDTO = {
    id: order.id,
    number: order.number,
    status,
    // Ops Board
    opsStatus: (order as any).opsStatus ?? null,
    opsLane: (order as any).opsLane ?? null,
    checklistState: (order as any).checklistState ?? null,
    // V2 Compat
    statusV2: state.canonicalStatus,
    isDraft: state.isDraft,
    onHold: state.onHold,
    inventoryStatus: state.inventoryStatus,
    completionType: state.completionType,

    statusLabel: getStatusLabel(status),
    statusProgress: getStatusProgress(status),
    priority: order.priority,
    channel: order.channel,

    // Summaries
    itemSummary: generateItemSummary(items),
    shippingAddressSummary: order.shippingAddress
      ? formatAddress(order.shippingAddress)
      : undefined,

    addressLine: (order as any)?.addressLine ?? null,
    city: order.city ?? null,
    addressRaw: (order as any)?.addressRaw ?? null,
    addressValidationStatus: (order as any)?.addressValidationStatus ?? null,
    addressValidationReason: (order as any)?.addressValidationReason ?? null,
    normalizedAddress: {
      city: order.city ?? order.shippingAddress?.city ?? null,
      street: (order as any)?.street ?? order.shippingAddress?.street ?? null,
      houseNumber: (order as any)?.houseNumber ?? order.shippingAddress?.number ?? null,
      floor: (order as any)?.floor ?? order.shippingAddress?.floor ?? null,
      apartment: (order as any)?.apartment ?? order.shippingAddress?.apartment ?? null,
    },
    // Compatibility fields
    street: (order as any)?.street ?? order.shippingAddress?.street ?? null,
    houseNumber: (order as any)?.houseNumber ?? order.shippingAddress?.number ?? null,
    floor: (order as any)?.floor ?? order.shippingAddress?.floor ?? null,
    apartment: (order as any)?.apartment ?? order.shippingAddress?.apartment ?? null,
    totalCents,
    paidAmountCents,
    notes: order.notes ?? order.notesInternal ?? null,
    note: order.notes ?? order.notesInternal ?? null,
    sourceStatus: order.sourceStatus ?? null,
    sourceReviewReason: order.sourceReviewReason ?? null,
    addressOverridden: order.addressOverridden ?? false,
    sourceAddressDiffers: Boolean(
      order.addressOverridden &&
      order.sourceShipping &&
      ['city', 'street', 'number', 'notes', 'floor', 'apartment'].some(
        (key) =>
          String((order.shippingAddress as any)?.[key] ?? '') !==
          String((order.sourceShipping as any)?.[key] ?? '')
      )
    ),
    coordinates:
      typeof (order as any)?.latitude === 'number' && typeof (order as any)?.longitude === 'number'
        ? { lat: (order as any).latitude, lng: (order as any).longitude }
        : typeof order.lat === 'number' && typeof order.lng === 'number'
          ? { lat: order.lat, lng: order.lng }
          : null,
    latitude: (order as any)?.latitude ?? order.lat ?? null,
    longitude: (order as any)?.longitude ?? order.lng ?? null,
    lat: order.lat ?? (order as any)?.latitude ?? null,
    lng: order.lng ?? (order as any)?.longitude ?? null,

    // Financial (cents → dollars)
    subTotal: subTotalCents / 100,
    tax: taxCents / 100,
    shipping: shippingCents / 100,
    discount: discountCents / 100,
    total: totalCents / 100,
    totalAmount: totalCents / 100,
    paidAmount: paidAmountCents / 100,
    outstandingBalance: (totalCents - paidAmountCents) / 100,
    paymentStatus: order.paymentStatus,
    payments: (order as any).payments ? normalizePayments((order as any).payments) : undefined,
    currency: order.currency,

    // Customer
    customer: order.customer
      ? {
          id: order.customer.id,
          name: order.customer.name,

          email: order.customer.email,
          phone: order.customer.phone,
          creditStatus: calculateCreditStatus(order.customer),
        }
      : order.customerName || order.customerPhone || order.customerEmail
        ? {
            id: (order as any).customerId ?? 'unknown',
            name: (order as any).customerName ?? '',
            email: (order as any).customerEmail ?? null,
            phone: (order as any).customerPhone ?? null,
          }
        : null,
    customerName: (order as any).customerName ?? order.customer?.name ?? null,
    customerPhone: (order as any).customerPhone ?? order.customer?.phone ?? null,
    customerEmail: (order as any).customerEmail ?? order.customer?.email ?? null,

    // Addresses
    billingAddress: order.billingAddress ? normalizeAddress(order.billingAddress) : null,
    shippingAddress: order.shippingAddress ? normalizeAddress(order.shippingAddress) : null,

    // Items
    items: items.map(normalizeOrderItem),
    itemsCount,

    // Labels
    labels: Array.isArray((order as any).labels)
      ? (order as any).labels.map((l: any) => ({
          id: l.id,
          name: l.name,
          color: l.color,
          stage: l.stage,
        }))
      : [],
    statusHistory: Array.isArray((order as any).statusHistory)
      ? (order as any).statusHistory.map((entry: any) => ({
          id: entry.id,
          fromStatus: entry.fromStatus ?? null,
          toStatus: entry.toStatus,
          reason: entry.reason ?? null,
          metadata: entry.metadata ?? null,
          createdAt: coerceDate(entry.createdAt) ?? new Date().toISOString(),
          changedByUser: entry.changedByUser
            ? {
                id: entry.changedByUser.id,
                name: entry.changedByUser.name,
              }
            : null,
        }))
      : [],
    noteEntries: Array.isArray((order as any).noteEntries)
      ? (order as any).noteEntries.map((entry: any) => ({
          id: entry.id,
          content: entry.content ?? '',
          createdAt: coerceDate(entry.createdAt) ?? new Date().toISOString(),
          user: entry.user
            ? {
                id: entry.user.id,
                name: entry.user.name,
              }
            : null,
        }))
      : [],

    // User
    assignedUser: order.assignedUser
      ? {
          id: order.assignedUser.id,
          name: order.assignedUser.name,
          email: order.assignedUser.email,
          role: order.assignedUser.role,
        }
      : null,
    assignedUserId: (order as any).assignedUserId ?? order.assignedUser?.id ?? null,
    deliveryAssignedToId: (order as any).deliveryAssignedToId ?? null,
    deliveryAssignedTo: (order as any).deliveryAssignedTo
      ? {
          id: (order as any).deliveryAssignedTo.id,
          name: (order as any).deliveryAssignedTo.name,
          email: (order as any).deliveryAssignedTo.email,
          role: (order as any).deliveryAssignedTo.role,
        }
      : null,

    // Timestamps (Date → ISO string)
    createdAt: coerceDate(order.createdAt) ?? new Date().toISOString(),
    updatedAt: coerceDate(order.updatedAt) ?? new Date().toISOString(),
    lastPaymentAt: coerceDate(order.lastPaymentAt),

    // Installer & Schedule
    installerName: (order as any).installerName ?? null,
    installerNotes: (order as any).installerNotes ?? null,
    notesToCrew: (order as any).notesToCrew ?? null,
    scheduledAt: coerceDate((order as any).scheduledAt),
    scheduledEnd: coerceDate((order as any).scheduledEnd),
    scheduleMode: (order as any).scheduleMode ?? null,
    timeWindowStart: (order as any).timeWindowStart ?? null,
    timeWindowEnd: (order as any).timeWindowEnd ?? null,
    dueDate: coerceDate((order as any).dueDate),
    installAt: coerceDate((order as any).installAt ?? (order as any).scheduledAt), // Compat

    // Computed fields
    isOverdue: calculateIsOverdue(order),
    daysInCurrentStatus: calculateDaysInStatus(order),
    nextAllowedStatuses: calculateNextAllowedStatuses(status),
    nextActions: getNextActions(order),
    workflowHints: {
      currentStage: getStatusLabel(status),
      description: getWorkflowStageDescription(status),
    },
    itemsChecklist: (order as any).itemsChecklist ?? {},
    orderChecklist: (order as any).orderChecklist ?? {},
  };

  // Add derived task info
  dto.derivedTask = deriveOrderTask({
    status: dto.status,
    onHold: dto.onHold,
    items: dto.items,
    fulfillmentType: order.fulfillmentType || 'DELIVERY',
  });

  return dto;
}
