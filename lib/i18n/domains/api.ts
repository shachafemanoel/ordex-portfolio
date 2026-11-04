import type { TranslateOptions } from '@/lib/i18n/types';

/**
 * API-specific translations for error messages, validation, and responses
 */

const API_TRANSLATIONS: Record<string, { he: string; en: string }> = {
  // Generic Errors
  'errors.notFound': { he: 'לא נמצא', en: 'Not Found' },
  'errors.unauthorized': { he: 'לא מורשה', en: 'Unauthorized' },
  'errors.forbidden': { he: 'אסור', en: 'Forbidden' },
  'errors.badRequest': { he: 'בקשה שגויה', en: 'Bad Request' },
  'errors.internalError': { he: 'שגיאת שרת פנימית', en: 'Internal Server Error' },
  'errors.serviceUnavailable': { he: 'השירות אינו זמין', en: 'Service Unavailable' },

  // Entity-Specific Errors
  'errors.orderNotFound': { he: 'הזמנה לא נמצאה', en: 'Order not found' },
  'errors.customerNotFound': { he: 'לקוח לא נמצא', en: 'Customer not found' },
  'errors.supplierNotFound': { he: 'ספק לא נמצא', en: 'Supplier not found' },
  'errors.productNotFound': { he: 'מוצר לא נמצא', en: 'Product not found' },
  'errors.taskNotFound': { he: 'משימה לא נמצאה', en: 'Task not found' },
  'errors.purchaseOrderNotFound': { he: 'הזמנת רכש לא נמצאה', en: 'Purchase order not found' },

  // Validation Errors
  'errors.validation.required': { he: 'שדה חובה חסר', en: 'Required field missing' },
  'errors.validation.invalidEmail': { he: 'כתובת אימייל לא תקינה', en: 'Invalid email address' },
  'errors.validation.invalidPhone': { he: 'מספר טלפון לא תקין', en: 'Invalid phone number' },
  'errors.validation.invalidFormat': { he: 'פורמט לא תקין', en: 'Invalid format' },
  'errors.validation.tooShort': { he: 'ערך קצר מדי', en: 'Value too short' },
  'errors.validation.tooLong': { he: 'ערך ארוך מדי', en: 'Value too long' },
  'errors.validation.outOfRange': { he: 'ערך מחוץ לטווח', en: 'Value out of range' },

  // Business Logic Errors
  'errors.insufficientStock': { he: 'מלאי לא מספיק', en: 'Insufficient stock' },
  'errors.duplicateEntry': { he: 'רשומה כפולה', en: 'Duplicate entry' },
  'errors.invalidStatus': { he: 'סטטוס לא תקין', en: 'Invalid status' },
  'errors.invalidTransition': { he: 'מעבר סטטוס לא תקין', en: 'Invalid status transition' },
  'errors.paymentFailed': { he: 'תשלום נכשל', en: 'Payment failed' },
  'errors.operationNotAllowed': { he: 'פעולה לא מורשית', en: 'Operation not allowed' },

  // Success Messages
  'success.created': { he: 'נוצר בהצלחה', en: 'Created successfully' },
  'success.updated': { he: 'עודכן בהצלחה', en: 'Updated successfully' },
  'success.deleted': { he: 'נמחק בהצלחה', en: 'Deleted successfully' },
  'success.saved': { he: 'נשמר בהצלחה', en: 'Saved successfully' },

  // Entity-Specific Success
  'success.orderCreated': { he: 'הזמנה נוצרה בהצלחה', en: 'Order created successfully' },
  'success.orderUpdated': { he: 'הזמנה עודכנה בהצלחה', en: 'Order updated successfully' },
  'success.customerCreated': { he: 'לקוח נוצר בהצלחה', en: 'Customer created successfully' },
  'success.customerUpdated': { he: 'לקוח עודכן בהצלחה', en: 'Customer updated successfully' },
  'success.paymentProcessed': { he: 'תשלום עובד בהצלחה', en: 'Payment processed successfully' },

  // Rate Limiting
  'errors.rateLimitExceeded': { he: 'חרגת ממגבלת הבקשות', en: 'Rate limit exceeded' },
  'errors.tooManyRequests': { he: 'יותר מדי בקשות', en: 'Too many requests' },

  // AI-Specific Errors
  'errors.aiNotConfigured': { he: 'שירות AI לא מוגדר', en: 'AI service not configured' },
  'errors.aiRequestFailed': { he: 'בקשת AI נכשלה', en: 'AI request failed' },
  'errors.aiTimeout': { he: 'תם הזמן לבקשת AI', en: 'AI request timeout' },
};

export function translateAPI(key: string, opts?: TranslateOptions): string {
  const locale = opts?.locale ?? 'he';
  const entry = API_TRANSLATIONS[key];
  if (!entry) return opts?.fallback ?? key;
  return entry[locale] ?? entry.he;
}
