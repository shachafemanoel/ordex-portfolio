import { storeSettingsSchema } from '@/lib/store-settings-schema';
import { z } from 'zod';

// Common validation helpers
export const phoneRegex = /^[\+]?[\d\s\-\(\)]{7,15}$/;
export const emailSchema = z.string().email('כתובת אימייל לא תקינה');
export const phoneSchema = z
  .string()
  .regex(phoneRegex, 'מספר טלפון לא תקין')
  .optional()
  .or(z.literal(''));
export const requiredString = z.string().min(1, 'שדה זה הוא חובה');
export const optionalString = z.string().optional().or(z.literal(''));

// User schemas
export const userCreateSchema = z.object({
  email: emailSchema,
  name: requiredString.min(2, 'שם חייב להכיל לפחות 2 תווים'),
  role: z.enum(['ADMIN', 'SALES', 'PURCHASING', 'INSTALLER'] as const, {
    errorMap: () => ({ message: 'בחר תפקיד תקין' }),
  }),
});

export const userUpdateSchema = userCreateSchema.partial().extend({
  id: requiredString,
});

// Client schemas
export const clientCreateSchema = z.object({
  name: requiredString.min(2, 'שם הלקוח חייב להכיל לפחות 2 תווים'),
  email: z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
  phone: phoneSchema,
  address: optionalString,
  city: optionalString,
  taxId: optionalString,
  contactPerson: optionalString,
  notes: optionalString,
});

export const clientUpdateSchema = clientCreateSchema.extend({
  id: requiredString,
});

// Supplier schemas
export const supplierCreateSchema = z.object({
  name: requiredString.min(2, 'שם הספק חייב להכיל לפחות 2 תווים'),
  taxId: optionalString,
  email: z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
  phone: phoneSchema,
  address: optionalString,
  contactPerson: optionalString,
  website: z.string().url('כתובת אתר לא תקינה').optional().or(z.literal('')),
  notes: optionalString,
});

export const supplierUpdateSchema = supplierCreateSchema.extend({
  id: requiredString,
});

// SKU schemas
export const skuCreateSchema = z.object({
  code: requiredString.min(1, 'קוד מוצר הוא חובה'),
  name: requiredString.min(2, 'שם המוצר חייב להכיל לפחות 2 תווים'),
  description: optionalString,
  category: optionalString,
  price: z.number().min(0, 'המחיר חייב להיות חיובי').optional(),
  supplierId: optionalString,
  stock: z.number().int().min(0, 'כמות המלאי חייבת להיות מספר שלם חיובי').optional(),
});

export const skuUpdateSchema = skuCreateSchema.extend({
  id: requiredString,
});

// Order schemas
export const orderItemSchema = z.object({
  productId: optionalString,
  qty: z.number().int().min(1, 'הכמות חייבת להיות לפחות 1'),
});

export const orderCreateSchema = z.object({
  customerName: requiredString.min(2, 'שם הלקוח חייב להכיל לפחות 2 תווים'),
  customerEmail: z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
  customerPhone: phoneSchema,
  address: requiredString.min(5, 'כתובת חייבת להכיל לפחות 5 תווים'),
  city: optionalString,
  houseNumber: optionalString,
  floor: optionalString,
  note: optionalString,
  totalAmount: z.number().min(0, 'סכום ההזמנה חייב להיות חיובי'),
  items: z.array(orderItemSchema).min(1, 'חובה להוסיף לפחות פריט אחד'),
  clientId: optionalString,
});

export const orderUpdateSchema = orderCreateSchema.partial().extend({
  id: requiredString,
});

export const orderStatusUpdateSchema = z.object({
  orderId: requiredString,
  status: z.enum(
    [
      'DRAFT',
      'TO_DO',
      'CALL_BACK',
      'PENDING_APPROVAL',
      'CONFIRMED',
      'PO_CREATED',
      'AWAITING_STOCK',
      'PARTIALLY_SUPPLIED',
      'READY_FOR_INSTALL',
      'INSTALL_SCHEDULING',
      'AWAITING_INSTALL',
      'SCHEDULED',
      'COMPLETED',
      'INSTALLED',
      'SUPPLIED',
      'CANCELLED',
    ] as const,
    {
      errorMap: () => ({ message: 'סטטוס הזמנה לא תקין' }),
    }
  ),
  reason: optionalString,
});

// Settings schema
export const settingsSchema = storeSettingsSchema;

// Notification template schema
export const notificationTemplateSchema = z.object({
  name: requiredString.min(2, 'שם התבנית חייב להכיל לפחות 2 תווים'),
  type: z.enum(['sms', 'whatsapp', 'email'], {
    errorMap: () => ({ message: 'בחר סוג הודעה תקין' }),
  }),
  trigger: z.enum(['installation_reminder', 'status_change', 'manual'], {
    errorMap: () => ({ message: 'בחר טריגר תקין' }),
  }),
  template: requiredString.min(10, 'תוכן התבנית חייב להכיל לפחות 10 תווים'),
  isActive: z.boolean(),
});

export const notificationTemplateUpdateSchema = notificationTemplateSchema.extend({
  id: requiredString,
});

// Calendar event schema
export const calendarEventSchema = z.object({
  orderId: requiredString,
  title: requiredString,
  description: optionalString,
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
  location: optionalString,
  attendees: z.array(emailSchema).optional(),
});

// Integration connection schema
export const integrationConnectionSchema = z.object({
  providerId: requiredString,
  accountLabel: requiredString.min(2, 'תיוג החשבון חייב להכיל לפחות 2 תווים'),
  secret: requiredString.min(1, 'סוד/טוקן הוא שדה חובה'),
});

// Goods receipt schemas
export const receiptItemSchema = z.object({
  orderItemId: requiredString,
  quantityReceived: z.number().int().min(0, 'הכמות לא יכולה להיות שלילית'),
  notes: optionalString,
});

export const receiptCreateSchema = z.object({
  purchaseOrderId: optionalString,
  supplierId: optionalString,
  reference: optionalString,
  notes: optionalString,
  items: z.array(receiptItemSchema).min(1, 'חובה להוסיף לפחות פריט אחד'),
});

export const receiptUpdateSchema = z.object({
  id: requiredString,
  reference: optionalString,
  notes: optionalString,
  items: z
    .array(
      z.object({
        id: requiredString,
        quantityReceived: z.number().int().min(0, 'הכמות לא יכולה להיות שלילית'),
        notes: optionalString,
      })
    )
    .optional(),
});

// Export all schemas as a single object for easier imports
export const schemas = {
  user: {
    create: userCreateSchema,
    update: userUpdateSchema,
  },
  client: {
    create: clientCreateSchema,
    update: clientUpdateSchema,
  },
  supplier: {
    create: supplierCreateSchema,
    update: supplierUpdateSchema,
  },
  sku: {
    create: skuCreateSchema,
    update: skuUpdateSchema,
  },
  order: {
    create: orderCreateSchema,
    update: orderUpdateSchema,
    statusUpdate: orderStatusUpdateSchema,
  },
  settings: settingsSchema,
  notificationTemplate: {
    create: notificationTemplateSchema,
    update: notificationTemplateUpdateSchema,
  },
  calendarEvent: calendarEventSchema,
  integrationConnection: integrationConnectionSchema,
  receipt: {
    create: receiptCreateSchema,
    update: receiptUpdateSchema,
    item: receiptItemSchema,
  },
} as const;
