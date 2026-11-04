import { OrderStatus, PurchaseOrderStatus, FulfillmentType, ScheduleMode } from '@prisma/client';

// Define explicit mapping to handle overlaps manually and safely
const OrderStatusLabels: Record<string, string> = {
  [OrderStatus.RECEIVED]: 'התקבל',
  [OrderStatus.PROCESSING]: 'בטיפול',
  [OrderStatus.READY]: 'מוכן',
  [OrderStatus.IN_TRANSIT]: 'בדרך',
  [OrderStatus.INSTALLATION]: 'בהתקנה',
  [OrderStatus.COMPLETED]: 'הושלם',
  [OrderStatus.DRAFT]: 'טיוטה',
  [OrderStatus.TO_DO]: 'לטיפול',
  [OrderStatus.CALL_BACK]: 'חזרה ללקוח',
  [OrderStatus.PENDING_APPROVAL]: 'ממתין לאישור',
  [OrderStatus.CONFIRMED]: 'אושר',
  [OrderStatus.PO_CREATED]: 'נוצרה הזמנת רכש',
  [OrderStatus.AWAITING_STOCK]: 'ממתין למלאי',
  [OrderStatus.PARTIALLY_SUPPLIED]: 'סופק חלקית',
  [OrderStatus.READY_FOR_INSTALL]: 'מוכן להתקנה',
  [OrderStatus.INSTALL_SCHEDULING]: 'תיאום התקנה',
  [OrderStatus.AWAITING_INSTALL]: 'ממתין להתקנה',
  [OrderStatus.SCHEDULED]: 'מתוזמן',
  [OrderStatus.INSTALLED]: 'הותקן',
  [OrderStatus.SUPPLIED]: 'סופק',
  [OrderStatus.INVOICED]: 'חשבונית',
  [OrderStatus.CLOSED]: 'נסגר',
  [OrderStatus.ON_HOLD]: 'מושהה',
  [OrderStatus.CANCELLED]: 'בוטל',
  [OrderStatus.REFUNDED]: 'הוחזר',
};

const PurchaseOrderStatusLabels: Record<string, string> = {
  [PurchaseOrderStatus.DRAFT]: 'טיוטה',
  [PurchaseOrderStatus.SENT]: 'נשלח לספק',
  [PurchaseOrderStatus.PARTIALLY_RECEIVED]: 'התקבל חלקית',
  [PurchaseOrderStatus.RECEIVED]: 'התקבל במלאי',
  [PurchaseOrderStatus.CANCELLED]: 'בוטל',
};

const FulfillmentLabels: Record<string, string> = {
  [FulfillmentType.DELIVERY]: 'משלוח',
  [FulfillmentType.PICKUP]: 'איסוף עצמי',
  [FulfillmentType.INSTALLATION]: 'התקנה',
};

const ScheduleLabels: Record<string, string> = {
  [ScheduleMode.SPECIFIC_TIME]: 'תאריך ושעה',
  [ScheduleMode.TIME_WINDOW]: 'חלון זמן',
  [ScheduleMode.ANYTIME]: 'כל היום',
};

// Merge all into one lookup, letting OrderStatus take precedence if duplicates exist (though they should map to same Hebrew ideally)
export const HebrewStatusLabels: Record<string, string> = {
  ...PurchaseOrderStatusLabels, // Spread first (less specific)
  ...OrderStatusLabels,       // Spread second (main entity)
  ...FulfillmentLabels,
  ...ScheduleLabels,
};

export function getHebrewLabel(key: string | null | undefined, fallback = '—'): string {
  if (!key) return fallback;
  return HebrewStatusLabels[key] || key;
}
