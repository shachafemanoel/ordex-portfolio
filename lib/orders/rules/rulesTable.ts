import { DeferBucket, OrderStatus, PaymentStatus, TaskLabel } from '@prisma/client';
import { Rule } from '@/lib/orders/rules/types';

export const RULES: Rule[] = [
  // R1 — Closed / Cancelled
  {
    id: 'R1',
    priority: 10,
    condition: (s) =>
      s.status === OrderStatus.SUPPLIED ||
      s.status === OrderStatus.CLOSED ||
      s.status === OrderStatus.CANCELLED ||
      s.status === OrderStatus.COMPLETED || // Maps to "סופק" usually
      s.status === OrderStatus.REFUNDED,
    resolve: (s) => ({
      taskLabel: TaskLabel.CLOSE_ORDER,
      checklist: [],
      deferBucket: DeferBucket.TODAY,
    }),
  },

  // R2 — Unpaid or callback requested
  // "IF payment not confirmed OR customerRequestCallback=true"
  {
    id: 'R2',
    priority: 20,
    condition: (s) =>
      s.customerRequestCallback ||
      (s.paymentStatus !== PaymentStatus.PAID &&
        s.paymentStatus !== PaymentStatus.AUTHORIZED &&
        s.paymentStatus !== PaymentStatus.PARTIAL) ||
      s.status === OrderStatus.CALL_BACK,
    resolve: (s) => {
      const isPaymentOk =
        s.paymentStatus === PaymentStatus.PAID ||
        s.paymentStatus === PaymentStatus.AUTHORIZED ||
        s.paymentStatus === PaymentStatus.PARTIAL;
      const isContacted = !s.customerRequestCallback && s.status !== OrderStatus.CALL_BACK; // Simplified proxy

      const missingFields = [];
      if (!s.address.city) missingFields.push('city');
      if (!s.address.street) missingFields.push('street');

      return {
        taskLabel: TaskLabel.CALLBACK_CUSTOMER,
        checklist: [
          {
            id: 'contacted_customer',
            labelHe: 'יצירת קשר עם לקוח',
            status: isContacted ? 'DONE' : 'TODO',
          },
          {
            id: 'payment_confirmed',
            labelHe: 'הסדרת תשלום',
            status: isPaymentOk ? 'DONE' : 'TODO',
          },
          {
            id: 'missing_details_completed',
            labelHe: 'השלמת פרטים חסרים',
            status: missingFields.length === 0 ? 'DONE' : 'TODO',
            missingFields,
          },
        ],
        deferBucket: isContacted ? DeferBucket.TOMORROW : DeferBucket.TODAY,
        allowedQuickActions: [
          { id: 'mark-customer-contacted', labelHe: 'סמן שנוצר קשר', kind: 'button' },
          { id: 'update-payment', labelHe: 'עדכון תשלום', kind: 'modal' },
          { id: 'update-address', labelHe: 'עדכון כתובת', kind: 'modal' },
        ],
      };
    },
  },

  // R3 — Prepare order / Verify stock after payment
  // IF status == לביצוע/טיפול (TO_DO / PROCESSING / RECEIVED) AND payment confirmed
  {
    id: 'R3',
    priority: 30,
    condition: (s) =>
      (s.status === OrderStatus.TO_DO ||
        s.status === OrderStatus.PROCESSING ||
        s.status === OrderStatus.RECEIVED) &&
      (s.paymentStatus === PaymentStatus.PAID ||
        s.paymentStatus === PaymentStatus.AUTHORIZED ||
        s.paymentStatus === PaymentStatus.PARTIAL),
    resolve: (s) => {
      // Per-item preparation checklist
      const itemChecklist = s.items.map((item) => ({
        id: `prepare_${item.sku}`,
        labelHe: `בדיקת פריט: ${item.sku}`,
        status: 'TODO' as const, // Always manual check in this phase
      }));

      return {
        taskLabel: TaskLabel.VERIFY_STOCK,
        checklist: [
          ...itemChecklist,
          {
            id: 'duration_set',
            labelHe: 'קביעת משך זמן עבודה',
            status: 'TODO' as const,
          },
        ],
        deferBucket: DeferBucket.TODAY,
        allowedQuickActions: [
          { id: 'accept-to-production', labelHe: 'סיום הכנה והעברה לייצור', kind: 'modal' },
          { id: 'awaiting-stock', labelHe: 'ממתין למלאי', kind: 'button' },
          { id: 'awaiting-customer', labelHe: 'ממתין ללקוח', kind: 'button' },
        ],
      };
    },
  },

  // R4 — Purchase order creation
  // IF status == הזמנת רכש (PO_CREATED)
  {
    id: 'R4',
    priority: 40,
    condition: (s) => s.status === OrderStatus.PO_CREATED,
    resolve: (s) => {
      const hasPO = s.purchaseOrders.length > 0;
      // Per-item supplier assignment checklist
      const itemChecklist = s.items.map((item) => ({
        id: `supplier_${item.sku}`,
        labelHe: item.supplierId ? `✓ ${item.sku} — ספק משויך` : `${item.sku} — חסר ספק`,
        status: (item.supplierId ? 'DONE' : 'TODO') as 'DONE' | 'TODO',
      }));
      return {
        taskLabel: TaskLabel.ASSIGN_SUPPLIERS,
        checklist: [
          ...itemChecklist,
          {
            id: 'purchase_order_generated',
            labelHe: 'הפקת דוח רכש',
            status: hasPO ? 'DONE' : 'TODO',
          },
        ],
        deferBucket: DeferBucket.TODAY,
        allowedQuickActions: [
          { id: 'create-purchase-order', labelHe: 'יצירת הזמנת רכש', kind: 'modal' },
          { id: 'send-to-supplier', labelHe: 'שלח לספק', kind: 'modal' },
          { id: 'approve-items', labelHe: 'סמן כסופק (מעבר לתיאום)', kind: 'button' },
        ],
      };
    },
  },

  // R5 — Awaiting goods receipt
  // IF status == ממתין לקבלת סחורה (AWAITING_STOCK)
  {
    id: 'R5',
    priority: 50,
    condition: (s) => s.status === OrderStatus.AWAITING_STOCK,
    resolve: (s) => {
      // Per-item receive status checklist
      const itemChecklist = s.items.map((item) => ({
        id: `receive_${item.sku}`,
        labelHe:
          item.qtyReceived >= item.qtyRequired
            ? `✓ ${item.sku} — התקבל (${item.qtyReceived}/${item.qtyRequired})`
            : `${item.sku} — ממתין (${item.qtyReceived}/${item.qtyRequired})`,
        status: (item.qtyReceived >= item.qtyRequired ? 'DONE' : 'TODO') as 'DONE' | 'TODO',
      }));
      const scheduleHint = s.scheduledAt
        ? {
            id: 'delivery_pre_scheduled',
            labelHe: '✓ משלוח תואם מראש (גם לפני קליטה מלאה)',
            status: 'DONE' as const,
          }
        : {
            id: 'delivery_pre_scheduled',
            labelHe: 'ניתן לתאם משלוח מראש גם לפני קליטה מלאה',
            status: 'DONE' as const,
          };
      return {
        taskLabel: TaskLabel.RECEIVE_GOODS,
        checklist: [...itemChecklist, scheduleHint],
        deferBucket: DeferBucket.TOMORROW, // Waiting on supplier
        allowedQuickActions: [
          { id: 'receive-goods', labelHe: 'קבלת סחורה', kind: 'modal' },
          { id: 'send-to-supplier', labelHe: 'שלח לספק', kind: 'modal' },
          { id: 'schedule-installation', labelHe: 'תיאום משלוח', kind: 'modal' },
        ],
      };
    },
  },

  // R6 — Partial goods receipt
  // IF status == סופק חלקי (PARTIALLY_SUPPLIED)
  {
    id: 'R6',
    priority: 60,
    condition: (s) => s.status === OrderStatus.PARTIALLY_SUPPLIED,
    resolve: (s) => {
      // Per-item receive status checklist
      const itemChecklist = s.items.map((item) => ({
        id: `receive_${item.sku}`,
        labelHe:
          item.qtyReceived >= item.qtyRequired
            ? `✓ ${item.sku} — התקבל (${item.qtyReceived}/${item.qtyRequired})`
            : `${item.sku} — ממתין (${item.qtyReceived}/${item.qtyRequired})`,
        status: (item.qtyReceived >= item.qtyRequired ? 'DONE' : 'TODO') as 'DONE' | 'TODO',
      }));
      const scheduleHint = s.scheduledAt
        ? {
            id: 'delivery_pre_scheduled',
            labelHe: '✓ משלוח תואם מראש (גם לפני קליטה מלאה)',
            status: 'DONE' as const,
          }
        : {
            id: 'delivery_pre_scheduled',
            labelHe: 'ניתן לתאם משלוח מראש גם לפני קליטה מלאה',
            status: 'DONE' as const,
          };
      return {
        taskLabel: TaskLabel.RECEIVE_GOODS_PARTIAL,
        checklist: [...itemChecklist, scheduleHint],
        deferBucket: DeferBucket.TODAY,
        allowedQuickActions: [
          { id: 'receive-goods', labelHe: 'קבלת סחורה', kind: 'modal' },
          { id: 'schedule-installation', labelHe: 'תיאום משלוח', kind: 'modal' },
        ],
      };
    },
  },

  // R7 — Ready for Delivery / Installation scheduling
  // IF status == תאום התקנה (INSTALL_SCHEDULING)
  {
    id: 'R7',
    priority: 70,
    condition: (s) =>
      s.status === OrderStatus.INSTALL_SCHEDULING ||
      s.status === OrderStatus.READY ||
      s.status === OrderStatus.READY_FOR_INSTALL,
    resolve: (s) => {
      const addressComplete = !!(s.address.city && s.address.street && s.address.number);
      const scheduled = !!s.scheduledAt;
      return {
        taskLabel: TaskLabel.SCHEDULE_INSTALLATION,
        checklist: [
          {
            id: 'address_complete',
            labelHe: 'כתובת מלאה',
            status: addressComplete ? 'DONE' : 'TODO',
          },
          {
            id: 'scheduled_at_set',
            labelHe: 'נקבע מועד אספקה/התקנה',
            status: scheduled ? 'DONE' : 'TODO',
          },
          {
            id: 'calendar_event_created',
            labelHe: 'נוצר אירוע ביומן',
            status: s.hasCalendarEvent ? 'DONE' : 'TODO',
          },
        ],
        deferBucket: DeferBucket.TODAY,
        allowedQuickActions: [
          { id: 'mark-ready-delivery', labelHe: 'סמן כמוכן למשלוח', kind: 'modal' },
          { id: 'schedule-installation', labelHe: 'תיאום התקנה ביומן', kind: 'modal' },
          { id: 'update-address', labelHe: 'עדכון כתובת', kind: 'modal' },
        ],
      };
    },
  },

  // R8 — Awaiting delivery day
  // IF status == ממתין להתקנה/הספקה (AWAITING_INSTALL)
  {
    id: 'R8',
    priority: 80,
    condition: (s) =>
      s.status === OrderStatus.AWAITING_INSTALL || s.status === OrderStatus.SCHEDULED,
    resolve: (s) => {
      const isToday = s.scheduledAt
        ? new Date(s.scheduledAt).toDateString() === new Date().toDateString()
        : false;
      return {
        taskLabel: TaskLabel.WAIT_INSTALLATION_DAY,
        checklist: [
          {
            id: 'scheduled_at_valid',
            labelHe: 'מועד תקין',
            status: s.scheduledAt ? 'DONE' : 'BLOCKED',
          },
        ],
        deferBucket: isToday ? DeferBucket.TODAY : DeferBucket.TOMORROW,
        allowedQuickActions: [
          { id: 'mark-supplied', labelHe: 'סמן כסופק (הושלם)', kind: 'button' },
        ],
      };
    },
  },

  // R8.5 — Recovery (Stuck but Paid)
  // IF payment method exists but status is stuck/legacy
  {
    id: 'R8.5',
    priority: 900,
    condition: (s) => s.hasPaymentMethod,
    resolve: (s) => ({
      taskLabel: TaskLabel.VERIFY_ORDER,
      checklist: [
        {
          id: 'recovery_check',
          labelHe: 'נדרש אישור ידני (הזמנה בסטטוס ישן)',
          status: 'TODO',
        },
      ],
      deferBucket: DeferBucket.TODAY,
      allowedQuickActions: [
        { id: 'force-approve-preparation', labelHe: 'אישור ידני להכנה', kind: 'button' },
      ],
    }),
  },

  // R9 — Fallback
  {
    id: 'R9',
    priority: 999,
    condition: () => true,
    resolve: (s) => ({
      taskLabel: TaskLabel.VERIFY_ORDER,
      checklist: [
        {
          id: 'check_status',
          labelHe: 'בדיקת סטטוס',
          status: 'TODO',
        },
      ],
      deferBucket: DeferBucket.TODAY,
      allowedQuickActions: [],
    }),
  },
];
