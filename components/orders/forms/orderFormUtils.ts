import { OrderStatus } from '@prisma/client';

export interface AddressForm {
  street: string;
  number: string;
  city: string;
  floor?: string;
  notes?: string;
}

export interface OrderItemSource {
  id: string;
  sku?: string | null;
  name?: string | null;
  qty?: number | null;
  unitPrice?: number | null;
  total?: number | null;
  received?: boolean | null;
  receivedQuantity?: number | null;
}

export interface OrderItemForm {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: string;
}

export interface OrderDetailsForm {
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  billingAddress: AddressForm;
  shippingAddress: AddressForm;
  currency: string;
  shippingCost: string;
  discount: string;
  notesInternal: string;
  items: OrderItemForm[];
}

export interface OrderForDetailsPrefill {
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  address: string;
  city?: string | null;
  billingAddress?: any;
  shippingAddress?: any;
  items?: any[];
  currency?: string | null;
  shippingCost?: number | null;
  discount?: number | null;
  note?: string | null;
}

export function generateTempId(): string {
  return `temp_${Math.random().toString(36).substr(2, 9)}`;
}

export function mapOrderToForm(order: OrderForDetailsPrefill): OrderDetailsForm {
  const billing = order.billingAddress || {};
  const shipping = order.shippingAddress || {};

  // Try to parse address string if structured data is missing
  // This is a naive implementation

  return {
    customer: {
      name: order.customerName || '',
      email: order.customerEmail || '',
      phone: order.customerPhone || '',
    },
    billingAddress: {
      street: billing.street || '',
      number: billing.number || '',
      city: billing.city || order.city || '',
      floor: billing.floor || '',
      notes: billing.notes || '',
    },
    shippingAddress: {
      street: shipping.street || '',
      number: shipping.number || '',
      city: shipping.city || order.city || '',
      floor: shipping.floor || '',
      notes: shipping.notes || '',
    },
    currency: order.currency || 'ILS',
    shippingCost: (order.shippingCost || 0).toString(),
    discount: (order.discount || 0).toString(),
    notesInternal: order.note || '',
    items: (order.items || []).map(item => ({
      id: item.id || generateTempId(),
      sku: item.sku?.code || item.sku || '',
      name: item.name || item.sku?.name || '',
      quantity: item.qty || item.quantity || 0,
      unitPrice: item.unitPrice || item.price || 0,
      vatRate: (item.vatRate || 17).toString(),
    })),
  };
}

export function collectMissingFields(form: OrderDetailsForm): string[] {
  const missing: string[] = [];
  if (!form.customer.name) missing.push('שם לקוח');
  if (!form.billingAddress.city) missing.push('עיר (חיוב)');
  if (!form.billingAddress.street) missing.push('רחוב (חיוב)');
  if (!form.shippingAddress.city) missing.push('עיר (משלוח)');
  if (!form.shippingAddress.street) missing.push('רחוב (משלוח)');
  if (form.items.length === 0) missing.push('פריטים');
  return missing;
}

export function validateOrderDetailsForm(form: OrderDetailsForm): { errors: Record<string, string>, missing: string[] } {
  const errors: Record<string, string> = {};
  if (!form.customer.name) errors['customer.name'] = 'שדה חובה';

  form.items.forEach((item, index) => {
    if (!item.name) errors[`items.${index}.name`] = 'שדה חובה';
    if (item.quantity <= 0) errors[`items.${index}.quantity`] = 'חייב להיות גדול מ-0';
    if (item.unitPrice < 0) errors[`items.${index}.unitPrice`] = 'לא יכול להיות שלילי';
  });

  return {
    errors,
    missing: collectMissingFields(form),
  };
}

export function buildOrderPayload(form: OrderDetailsForm): any {
  return {
    customerName: form.customer.name,
    customerEmail: form.customer.email,
    customerPhone: form.customer.phone,
    billingAddress: {
      ...form.billingAddress
    },
    shippingAddress: {
      ...form.shippingAddress
    },
    currency: form.currency,
    shippingCost: parseFloat(form.shippingCost) || 0,
    discount: parseFloat(form.discount) || 0,
    note: form.notesInternal,
    items: form.items.map(item => ({
      id: item.id.startsWith('temp_') ? undefined : item.id,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: parseFloat(item.vatRate) || 0,
    })),
  };
}
