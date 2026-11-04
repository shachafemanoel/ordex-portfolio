import type { OrderWithRelations } from '@/lib/api/types';
import { normalizeOrderStatus } from '@/lib/orderStatus';

type RequirementItem = {
  allocationStatus?: string | null;
  received?: boolean | null;
  receivedQuantity?: number | null;
  quantity?: number | null;
};

export type OrderRequirementKey = 'items' | 'schedule' | 'delivery';
export type OrderRequirementTone =
  | 'critical'
  | 'warning'
  | 'active'
  | 'delivery'
  | 'success'
  | 'neutral';
export type OrderRequirementActionKind =
  | 'purchase'
  | 'schedule'
  | 'ready'
  | 'checklist'
  | 'issue'
  | 'none';

export interface OrderRequirementSignal {
  key: OrderRequirementKey;
  title: string;
  shortLabel: string;
  description: string;
  tone: OrderRequirementTone;
  trackerState: 'required' | 'waiting' | 'done';
  actionKind: OrderRequirementActionKind;
  actionLabel?: string;
  priority: number;
  done: boolean;
  blocked: boolean;
}

export interface OrderRequirementSummary {
  progress: number;
  progressTone: OrderRequirementTone;
  primarySignal: OrderRequirementSignal;
  signals: OrderRequirementSignal[];
  counts: {
    totalItems: number;
    readyItems: number;
    onOrderItems: number;
    missingItems: number;
  };
}

const DELIVERY_DONE_STATUSES = new Set([
  'COMPLETED',
  'SUPPLIED',
  'INVOICED',
  'CLOSED',
  'INSTALLED',
]);

const DELIVERY_ACTIVE_STATUSES = new Set([
  'READY',
  'READY_FOR_INSTALL',
  'AWAITING_INSTALL',
  'SCHEDULED',
  'IN_TRANSIT',
  'INSTALLATION',
]);

function isItemReady(item: RequirementItem) {
  const quantity = Math.max(1, item.quantity ?? 0);
  return (
    item.received === true ||
    (item.receivedQuantity ?? 0) >= quantity ||
    item.allocationStatus === 'ALLOCATED'
  );
}

export function buildOrderRequirementSummary(
  order: Pick<OrderWithRelations, 'status' | 'scheduledAt' | 'derivedTask'>,
  items: RequirementItem[]
): OrderRequirementSummary {
  const normalizedStatus = normalizeOrderStatus(String(order.status));
  const totalItems = items.length;
  const readyItems = items.filter(isItemReady).length;
  const onOrderItems = items.filter(
    (item) => !isItemReady(item) && item.allocationStatus === 'ON_ORDER'
  ).length;
  const missingItems = items.filter(
    (item) => !isItemReady(item) && item.allocationStatus !== 'ON_ORDER'
  ).length;

  const inventoryDone = totalItems > 0 && readyItems === totalItems;
  const hasScheduledAt = Boolean(order.scheduledAt);
  const deliveryDone = DELIVERY_DONE_STATUSES.has(normalizedStatus);

  const itemsSignal: OrderRequirementSignal =
    totalItems === 0
      ? {
          key: 'items',
          title: 'פריטים ומלאי',
          shortLabel: 'ללא פריטים',
          description: 'צריך להוסיף או לשייך פריטים לפני המשך הטיפול בהזמנה.',
          tone: 'active',
          trackerState: 'required',
          actionKind: 'issue',
          actionLabel: 'בדיקת פריטים',
          priority: 0,
          done: false,
          blocked: false,
        }
      : inventoryDone
        ? {
            key: 'items',
            title: 'פריטים ומלאי',
            shortLabel: 'מוכן',
            description: `${readyItems}/${totalItems} פריטים זמינים להזמנה.`,
            tone: 'success',
            trackerState: 'done',
            actionKind: 'issue',
            actionLabel: 'בעיה בפריט',
            priority: 0,
            done: true,
            blocked: false,
          }
        : missingItems > 0
          ? {
              key: 'items',
              title: 'פריטים ומלאי',
              shortLabel: 'חסר מלאי',
              description: `${missingItems} פריטים דורשים עדכון מלאי או רכש.`,
              tone: 'active',
              trackerState: 'required',
              actionKind: 'purchase',
              actionLabel: 'עדכון מלאי / רכש',
              priority: 0,
              done: false,
              blocked: false,
            }
          : {
              key: 'items',
              title: 'פריטים ומלאי',
              shortLabel: 'ממתין לאספקה',
              description: `${onOrderItems} פריטים כבר הוזמנו ומחכים לאספקה.`,
              tone: 'warning',
              trackerState: 'waiting',
              actionKind: 'purchase',
              actionLabel: 'מעקב רכש',
              priority: 0,
              done: false,
              blocked: false,
            };

  const scheduleSignal: OrderRequirementSignal = hasScheduledAt
    ? {
        key: 'schedule',
        title: 'תיאום התקנה',
        shortLabel: 'מתואם',
        description: 'מועד האספקה/התקנה נקבע ומוכן לעדכון במידת הצורך.',
        tone: 'success',
        trackerState: 'done',
        actionKind: 'schedule',
        actionLabel: 'עדכון תיאום',
        priority: 1,
        done: true,
        blocked: false,
      }
    : inventoryDone
      ? {
          key: 'schedule',
          title: 'תיאום התקנה',
          shortLabel: 'נדרש תיאום',
          description: 'כל הפריטים מוכנים. עכשיו צריך לקבוע מועד עם הלקוח.',
          tone: 'active',
          trackerState: 'required',
          actionKind: 'schedule',
          actionLabel: 'תיאום התקנה',
          priority: 1,
          done: false,
          blocked: false,
        }
      : {
          key: 'schedule',
          title: 'תיאום התקנה',
          shortLabel: 'ממתין לפריטים',
          description: 'התיאום ייפתח אחרי השלמת המלאי והכנת כל הפריטים.',
          tone: 'warning',
          trackerState: 'waiting',
          actionKind: 'none',
          priority: 1,
          done: false,
          blocked: true,
        };

  const deliverySignal: OrderRequirementSignal = deliveryDone
    ? {
        key: 'delivery',
        title: 'מסירה ללקוח',
        shortLabel: 'הושלם',
        description: 'ההזמנה הושלמה ונמסרה ללקוח.',
        tone: 'success',
        trackerState: 'done',
        actionKind: 'none',
        priority: 2,
        done: true,
        blocked: false,
      }
    : !hasScheduledAt
      ? {
          key: 'delivery',
          title: 'מסירה ללקוח',
          shortLabel: 'ממתין לתיאום',
          description: 'לא ניתן להשלים מסירה לפני קביעת מועד אספקה/התקנה.',
          tone: 'warning',
          trackerState: 'waiting',
          actionKind: 'none',
          priority: 2,
          done: false,
          blocked: true,
        }
      : DELIVERY_ACTIVE_STATUSES.has(normalizedStatus)
        ? {
            key: 'delivery',
            title: 'מסירה ללקוח',
            shortLabel: 'בביצוע',
            description:
              normalizedStatus === 'SCHEDULED' || normalizedStatus === 'READY'
                ? 'ההזמנה מתואמת. נדרש להעביר לביצוע או לאשר מסירה.'
                : 'נדרש לעקוב אחרי הביצוע ולאשר סיום מול הלקוח.',
            tone: 'active',
            actionKind:
              normalizedStatus === 'SCHEDULED' ||
              normalizedStatus === 'IN_TRANSIT' ||
              normalizedStatus === 'INSTALLATION'
                ? 'checklist'
                : 'ready',
            actionLabel:
              normalizedStatus === 'SCHEDULED' ||
              normalizedStatus === 'IN_TRANSIT' ||
              normalizedStatus === 'INSTALLATION'
                ? 'אישור מסירה'
                : 'העבר לביצוע',
            trackerState: 'required',
            priority: 2,
            done: false,
            blocked: false,
          }
        : {
            key: 'delivery',
            title: 'מסירה ללקוח',
            shortLabel: 'ממתין לשלב הבא',
            description: 'המסירה תיפתח לאחר סיום התיאום והעברה לביצוע.',
            tone: 'warning',
            trackerState: 'waiting',
            actionKind: 'none',
            priority: 2,
            done: false,
            blocked: true,
          };

  const signals = [itemsSignal, scheduleSignal, deliverySignal];
  const fallbackProgress = Math.round(
    (signals.filter((signal) => signal.done).length / signals.length) * 100
  );
  const progress = Math.max(order.derivedTask?.progressPct ?? 0, fallbackProgress);
  const primarySignal =
    signals.find((signal) => !signal.done && !signal.blocked) ??
    signals.find((signal) => !signal.done) ??
    signals[signals.length - 1];
  const progressTone: OrderRequirementTone = primarySignal.done ? 'success' : primarySignal.tone;

  return {
    progress,
    progressTone,
    primarySignal,
    signals,
    counts: {
      totalItems,
      readyItems,
      onOrderItems,
      missingItems,
    },
  };
}
