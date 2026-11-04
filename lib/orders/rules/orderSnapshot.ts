import {
  AddressValidationStatus,
  CalendarEvent,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentStatus,
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@prisma/client';

export interface OrderSnapshot {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  hasPaymentMethod: boolean;
  customerRequestCallback: boolean;
  address: {
    city: string | null;
    street: string | null;
    number: string | null;
    floor: string | null;
    notes: string | null;
    validationStatus: AddressValidationStatus | null;
  };
  items: Array<{
    sku: string;
    qtyRequired: number;
    qtyReceived: number;
    supplierId: string | null;
  }>;
  purchaseOrders: Array<{
    status: PurchaseOrderStatus;
  }>;
  scheduledAt: Date | null;
  hasCalendarEvent: boolean;
  waitUntil: Date | null;
}

// Type that matches what we expect from Prisma + manual PO fetch
export interface OrderWithRelations extends Order {
  customerRequestCallback?: boolean;
  waitUntil?: Date | null;
  items: OrderItem[];
  shippingAddress: {
    city: string | null;
    street: string | null;
    number: string | null;
    floor: string | null;
    notes: string | null;
  } | null;
  calendarEvents: CalendarEvent[];
  relatedPurchaseOrders?: Array<Pick<PurchaseOrder, 'status'>>;
  payments?: Payment[];
}

export function buildOrderSnapshot(order: OrderWithRelations): OrderSnapshot {
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    hasPaymentMethod: order.payments ? order.payments.some((p) => !!p.method) : false,
    customerRequestCallback: order.customerRequestCallback ?? order.status === OrderStatus.CALL_BACK,
    address: {
      // Prefer shipping address, fallback to Order fields if needed (though Order fields are legacy/denormalized)
      city: order.shippingAddress?.city ?? order.city,
      street: order.shippingAddress?.street ?? order.street,
      number: order.shippingAddress?.number ?? order.houseNumber,
      floor: order.shippingAddress?.floor ?? order.floor,
      notes: order.shippingAddress?.notes ?? order.notesToCrew,
      validationStatus: order.addressValidationStatus,
    },
    items: order.items.map((item) => ({
      sku: item.sku,
      qtyRequired: item.qty,
      qtyReceived:
        item.receivedQuantity > 0
          ? item.receivedQuantity
          : item.received || item.allocationStatus === 'ALLOCATED'
            ? item.qty
            : 0,
      supplierId: item.supplierId,
    })),
    purchaseOrders: (order.relatedPurchaseOrders || []).map((po) => ({
      status: po.status,
    })),
    scheduledAt: order.scheduledAt,
    hasCalendarEvent: order.calendarEvents.length > 0,
    waitUntil: order.waitUntil ?? order.opsSnoozeUntil ?? null,
  };
}
