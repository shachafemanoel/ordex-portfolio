import { z } from 'zod';

export class IntakeError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

// Woo prices are decimal strings, never binary floats. Reject precision loss or missing amounts.
export function cents(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new IntakeError('INVALID_AMOUNT');
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 2_147_483_647)
    throw new IntakeError('INVALID_AMOUNT');
  return amount;
}

const money = z.string().transform(cents);
const sourceDate = z
  .string()
  .refine((v) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(v) && Number.isFinite(Date.parse(v + 'Z')))
  .transform((v) => new Date(v + 'Z'));
const address = z.object({
  first_name: z.string().default(''),
  last_name: z.string().default(''),
  address_1: z.string(),
  address_2: z.string().default(''),
  city: z.string(),
  country: z.string().default(''),
  postcode: z.string().default(''),
});
const line = z.object({
  id: z.number().int().positive(),
  product_id: z.number().int().nonnegative(),
  variation_id: z.number().int().nonnegative().default(0),
  name: z.string().min(1),
  sku: z.string(),
  quantity: z.number().int().positive(),
  subtotal: money,
  total: money,
  total_tax: money,
});
export const storeOrderSchema = z.object({
  id: z.number().int().positive(),
  number: z.string().min(1),
  customer_id: z.number().int().nonnegative(),
  status: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  date_modified_gmt: sourceDate,
  date_paid_gmt: sourceDate.nullable(),
  total: money,
  total_tax: money,
  shipping_total: money,
  discount_total: money,
  billing: address.extend({ phone: z.string(), email: z.string().default('') }),
  shipping: address,
  line_items: z.array(line).min(1),
  fee_lines: z.array(z.object({ total: money })).default([]),
  refunds: z.array(z.object({ id: z.number(), total: z.string() })).default([]),
});

export function transformOrder(payload: unknown) {
  const parsed = storeOrderSchema.safeParse(payload);
  if (!parsed.success) throw new IntakeError('INVALID_ORDER_DATA');
  const o = parsed.data;
  if (new Set(o.line_items.map((l) => l.id)).size !== o.line_items.length)
    throw new IntakeError('DUPLICATE_LINE');
  const subTotalCents =
    o.line_items.reduce((s, l) => s + l.subtotal, 0) + o.fee_lines.reduce((s, l) => s + l.total, 0);
  const net =
    o.line_items.reduce((s, l) => s + l.total, 0) + o.fee_lines.reduce((s, l) => s + l.total, 0);
  if (
    subTotalCents - o.discount_total !== net ||
    net + o.total_tax + o.shipping_total !== o.total
  ) {
    throw new IntakeError('INCONSISTENT_TOTALS');
  }
  const customerName = [o.billing.first_name, o.billing.last_name].filter(Boolean).join(' ').trim();
  if (
    !customerName ||
    !o.billing.phone.trim() ||
    !o.shipping.city.trim() ||
    !o.shipping.address_1.trim()
  ) {
    throw new IntakeError('MISSING_CUSTOMER_OR_ADDRESS');
  }
  const known = [
    'pending',
    'on-hold',
    'processing',
    'completed',
    'cancelled',
    'refunded',
    'failed',
  ];
  const review = !known.includes(o.status)
    ? 'UNKNOWN_STORE_STATUS'
    : ['cancelled', 'refunded', 'failed'].includes(o.status) || o.refunds.length
      ? 'STORE_CANCELLATION_OR_REFUND'
      : null;
  const paid =
    Boolean(o.date_paid_gmt) && ['processing', 'completed'].includes(o.status) && !review;
  // Woo stores the street and number together; leave missing numbers empty for operator review.
  const shipping = splitAddress(o.shipping);
  return {
    source: o,
    subTotalCents,
    customerName,
    shipping,
    review,
    paidAmountCents: paid ? o.total : 0,
    paymentStatus: paid ? ('PAID' as const) : ('PENDING' as const),
  };
}

export function splitAddress(a: { address_1: string; address_2: string; city: string }) {
  const match = /^(.*?)\s+(\d+[\p{L}\d\/-]*)$/u.exec(a.address_1.trim());
  return {
    city: a.city.trim(),
    street: match ? match[1] : a.address_1.trim(),
    number: match?.[2] ?? '',
    notes: a.address_2 || null,
  };
}

export const storeProductSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  sku: z.string().min(1),
  type: z.enum(['simple', 'variable', 'variation']),
  price: z.string().transform((v) => (v === '' ? null : cents(v))),
  date_modified_gmt: sourceDate,
  stock_quantity: z.number().int().nonnegative().nullable(),
  stock_status: z.string(),
});
