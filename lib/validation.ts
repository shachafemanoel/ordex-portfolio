// import { OrderStatus } from '@prisma/client';
import { orderStatusInputSchema } from '@/lib/schemas';
import { z } from 'zod';

// Base validation schemas
export const emailSchema = z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal(''));

export const phoneSchema = z
  .string()
  .regex(/^[\d\-\+\(\)\s]+$/, 'מספר טלפון לא תקין')
  .optional()
  .or(z.literal(''));

export const dateSchema = z.string().datetime().or(z.date()).optional();

export const positiveNumberSchema = z.number().positive('הערך חייב להיות חיובי');

export const nonNegativeNumberSchema = z.number().nonnegative('הערך לא יכול להיות שלילי');

// Enum validation schemas - Updated to match new status machine
// Accept spec/legacy labels and normalize to canonical Prisma enum
export const orderStatusSchema = orderStatusInputSchema;

export const userRoleSchema = z.enum(['ADMIN', 'OPERATIONS'] as const);

export const purchaseOrderStatusSchema = z.enum([
  'OPEN',
  'PARTIAL',
  'COMPLETE',
  'CANCELLED',
] as const);

// Order validation schemas
const legacyOrderItemSchema = z.object({
  productId: z.string().optional(),
  qty: positiveNumberSchema,
});

const legacyOrderFormSchema = z.object({
  customerName: z
    .string()
    .min(2, 'שם הלקוח חייב להכיל לפחות 2 תווים')
    .max(100, 'שם הלקוח ארוך מדי'),
  customerEmail: emailSchema,
  customerPhone: phoneSchema,
  address: z.string().min(5, 'כתובת חייבת להכיל לפחות 5 תווים').max(200, 'כתובת ארוכה מדי'),
  city: z.string().max(50, 'שם העיר ארוך מדי').optional().or(z.literal('')),
  houseNumber: z.string().max(10, 'מספר בית ארוך מדי').optional().or(z.literal('')),
  floor: z.string().max(10, 'מספר קומה ארוך מדי').optional().or(z.literal('')),
  note: z.string().max(500, 'הערה ארוכה מדי').optional().or(z.literal('')),
  totalAmount: positiveNumberSchema,
  items: z.array(legacyOrderItemSchema).min(1, 'חייב להיות לפחות פריט אחד בהזמנה'),
});

const addressDetailsSchema = z.object({
  city: z.string().min(1, 'עיר היא שדה חובה').max(100, 'שם העיר ארוך מדי'),
  street: z.string().min(1, 'רחוב הוא שדה חובה').max(150, 'שם הרחוב ארוך מדי'),
  number: z.string().min(1, 'מספר בית נדרש').max(20, 'מספר בית ארוך מדי'),
  floor: z.string().max(10, 'מספר קומה ארוך מדי').optional().or(z.literal('')),
  notes: z.string().max(200, 'הערות ארוכות מדי').optional().or(z.literal('')),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  formattedAddress: z.string().nullable().optional(),
  placeId: z.string().nullable().optional(),
});

const manualOrderItemSchema = z.object({
  sku: z.string().max(64, 'קוד מק״ט ארוך מדי').optional().or(z.literal('')),
  name: z.string().min(1, 'שם הפריט נדרש').max(200, 'שם הפריט ארוך מדי'),
  quantity: z.number().int().positive('כמות חייבת להיות חיובית'),
  unitPrice: z.number().positive('מחיר ליחידה חייב להיות גדול מאפס'),
  vatRate: z.number().min(0).max(1).optional(),
});

const manualOrderFormSchema = z.object({
  customer: z.object({
    name: z.string().min(2, 'שם הלקוח חייב להכיל לפחות 2 תווים').max(100),
    email: emailSchema,
    phone: phoneSchema,
  }),
  billingAddress: addressDetailsSchema,
  shippingAddress: addressDetailsSchema,
  items: z.array(manualOrderItemSchema).min(1, 'חובה להוסיף לפחות פריט אחד'),
  currency: z.string().length(3).default('ILS'),
  notesInternal: z.string().max(500, 'הערות ארוכות מדי').optional().or(z.literal('')),
  shippingCost: z.number().nonnegative('עלות משלוח חייבת להיות חיובית').optional(),
  discount: z.number().nonnegative('הנחה חייבת להיות חיובית').optional(),
});

export const orderFormSchema = z.union([legacyOrderFormSchema, manualOrderFormSchema]);

export const orderUpdateSchema = z.object({
  status: orderStatusSchema.optional(),
  customerName: z.string().min(2).max(100).optional(),
  customerEmail: emailSchema.optional(),
  customerPhone: phoneSchema.optional(),
  address: z.string().min(5).max(200).optional(),
  city: z.string().max(50).optional(),
  houseNumber: z.string().max(10).optional(),
  floor: z.string().max(10).optional(),
  note: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  subTotal: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  shipping: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional(),
  installAt: dateSchema.optional(),
  assignedUserId: z.string().nullable().optional(),
  deliveryAssignedToId: z.string().nullable().optional(),
  completedAt: dateSchema.optional(),
  labels: z.array(z.string()).optional(),
  urgent: z.boolean().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  formattedAddress: z.string().nullable().optional(),
  placeId: z.string().nullable().optional(),
});

// Backwards-compatible export name expected by API routes
export const OrderUpdateSchema = orderUpdateSchema;

export const statusUpdateSchema = z.object({
  status: orderStatusSchema,
  reason: z.string().max(200, 'סיבה ארוכה מדי').optional(),
  installAt: dateSchema,
  installerName: z
    .union([
      z.string().trim().min(2, 'שם המתקין חייב להכיל לפחות 2 תווים').max(120, 'שם המתקין ארוך מדי'),
      z.literal(null),
    ])
    .optional(),
  installerNotes: z
    .union([
      z
        .string()
        .trim()
        .min(2, 'הערות למתקין חייבות להכיל לפחות 2 תווים')
        .max(500, 'הערות למתקין ארוכות מדי'),
      z.literal(null),
    ])
    .optional(),
});

export const itemUpdateSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      received: z.boolean(),
    })
  ),
});

// Supplier validation schemas
export const supplierFormSchema = z.object({
  name: z.string().min(2, 'שם הספק חייב להכיל לפחות 2 תווים').max(100, 'שם הספק ארוך מדי'),
  taxId: z
    .string()
    .regex(/^\d{9}$/, 'מספר עוסק חייב להכיל 9 ספרות')
    .optional()
    .or(z.literal('')),
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().max(200, 'כתובת ארוכה מדי').optional().or(z.literal('')),
  contactPerson: z.string().max(100, 'שם איש הקשר ארוך מדי').optional().or(z.literal('')),
  website: z.string().url('כתובת אתר לא תקינה').optional().or(z.literal('')),
  notes: z.string().max(500, 'הערות ארוכות מדי').optional().or(z.literal('')),
});

// Client validation schemas
export const clientFormSchema = z.object({
  name: z.string().min(2, 'שם הלקוח חייב להכיל לפחות 2 תווים').max(100, 'שם הלקוח ארוך מדי'),
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().max(200, 'כתובת ארוכה מדי').optional().or(z.literal('')),
  city: z.string().max(50, 'שם העיר ארוך מדי').optional().or(z.literal('')),
  taxId: z
    .string()
    .regex(/^\d{9}$/, 'מספר עוסק חייב להכיל 9 ספרות')
    .optional()
    .or(z.literal('')),
  contactPerson: z.string().max(100, 'שם איש הקשר ארוך מדי').optional().or(z.literal('')),
  notes: z.string().max(500, 'הערות ארוכות מדי').optional().or(z.literal('')),
});

// Product validation schemas
export const productFormSchema = z.object({
  code: z
    .string()
    .min(2, 'קוד מוצר חייב להכיל לפחות 2 תווים')
    .max(50, 'קוד מוצר ארוך מדי')
    .regex(/^[A-Za-z0-9\-_]+$/, 'קוד מוצר יכול להכיל רק אותיות, מספרים, מקף וקו תחתון'),
  name: z.string().min(2, 'שם המוצר חייב להכיל לפחות 2 תווים').max(200, 'שם המוצר ארוך מדי'),
  description: z.string().max(500, 'תיאור ארוך מדי').optional().or(z.literal('')),
  category: z.string().max(50, 'קטגוריה ארוכה מדי').optional().or(z.literal('')),
  price: nonNegativeNumberSchema.optional(),
  supplierId: z.string().optional().or(z.literal('')),
});

// User validation schemas
export const userFormSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים').max(100, 'שם ארוך מדי').optional(),
  role: userRoleSchema,
});

export const userUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(100).optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

// Filter validation schemas
export const orderFilterSchema = z.object({
  status: z.array(orderStatusSchema).optional(),
  q: z.string().max(200).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['createdAt', 'updatedAt', 'number', 'customerName', 'totalAmount', 'status'])
    .default('createdAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  userId: z.string().optional(),
  clientId: z.string().optional(),
  city: z.string().optional(),
});

export const reportFilterSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  status: z.array(orderStatusSchema).optional(),
  supplierId: z.string().optional(),
  city: z.string().optional(),
  userId: z.string().optional(),
  clientId: z.string().optional(),
});

// Calendar event validation schemas
export const calendarEventSchema = z
  .object({
    orderId: z.string(),
    title: z.string().min(2, 'כותרת חייבת להכיל לפחות 2 תווים').max(100, 'כותרת ארוכה מדי'),
    description: z.string().max(500, 'תיאור ארוך מדי').optional().or(z.literal('')),
    startTime: z.string().datetime('זמן התחלה לא תקין'),
    endTime: z.string().datetime('זמן סיום לא תקין'),
    location: z.string().max(200, 'מיקום ארוך מדי').optional().or(z.literal('')),
    attendees: z.array(z.string().email('כתובת אימייל לא תקינה')).optional().default([]),
  })
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return end > start;
    },
    {
      message: 'זמן הסיום חייב להיות אחרי זמן ההתחלה',
      path: ['endTime'],
    }
  );

// Notification validation schemas
export const notificationTemplateSchema = z.object({
  name: z.string().min(2, 'שם התבנית חייב להכיל לפחות 2 תווים').max(100, 'שם התבנית ארוך מדי'),
  type: z.enum(['sms', 'whatsapp', 'email']),
  trigger: z.enum(['installation_reminder', 'status_change', 'manual']),
  template: z
    .string()
    .min(10, 'תבנית ההודעה חייבת להכיל לפחות 10 תווים')
    .max(1000, 'תבנית ההודעה ארוכה מדי'),
});

export const sendNotificationSchema = z.object({
  orderId: z.string().optional(),
  templateId: z.string(),
  recipient: z.string().min(1, 'נמען חובה'),
  customMessage: z.string().max(1000, 'הודעה מותאמת ארוכה מדי').optional(),
});

// Purchase Order validation schemas
export const generatePurchaseOrderSchema = z.object({
  orderIds: z.array(z.string()).min(1, 'חייב לבחור לפחות הזמנה אחת'),
});

export const purchaseOrderUpdateSchema = z.object({
  status: purchaseOrderStatusSchema,
});

// Pagination validation schema
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

// Date range validation schema
export const dateRangeSchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .refine(
    (data) => {
      const from = new Date(data.from);
      const to = new Date(data.to);
      return to > from;
    },
    {
      message: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה',
      path: ['to'],
    }
  );

// Export utility functions for validation
export function validateOrderForm(data: unknown) {
  return orderFormSchema.safeParse(data);
}

export function validateSupplierForm(data: unknown) {
  return supplierFormSchema.safeParse(data);
}

export function validateClientForm(data: unknown) {
  return clientFormSchema.safeParse(data);
}

export function validateProductForm(data: unknown) {
  return productFormSchema.safeParse(data);
}

export function validateUserForm(data: unknown) {
  return userFormSchema.safeParse(data);
}

export function validateOrderFilter(data: unknown) {
  return orderFilterSchema.safeParse(data);
}

export function validateReportFilter(data: unknown) {
  return reportFilterSchema.safeParse(data);
}

export function validateCalendarEvent(data: unknown) {
  return calendarEventSchema.safeParse(data);
}

export function validateNotificationTemplate(data: unknown) {
  return notificationTemplateSchema.safeParse(data);
}

export function validateSendNotification(data: unknown) {
  return sendNotificationSchema.safeParse(data);
}

export function validateGeneratePurchaseOrder(data: unknown) {
  return generatePurchaseOrderSchema.safeParse(data);
}

export function validateDateRange(data: unknown) {
  return dateRangeSchema.safeParse(data);
}

// Error message helpers
export function getValidationErrorMessage(error: z.ZodError): string {
  const firstError = error.errors[0];
  return firstError?.message || 'שגיאת אימות';
}

export function getValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });

  return errors;
}

// Type exports for form components
export type OrderFormData = z.infer<typeof orderFormSchema>;
export type SupplierFormData = z.infer<typeof supplierFormSchema>;
export type ClientFormData = z.infer<typeof clientFormSchema>;
export type ProductFormData = z.infer<typeof productFormSchema>;
export type UserFormData = z.infer<typeof userFormSchema>;
export type OrderFilterData = z.infer<typeof orderFilterSchema>;
export type ReportFilterData = z.infer<typeof reportFilterSchema>;
export type CalendarEventData = z.infer<typeof calendarEventSchema>;
export type NotificationTemplateData = z.infer<typeof notificationTemplateSchema>;
export type SendNotificationData = z.infer<typeof sendNotificationSchema>;
