import { blockers, type DemoOrder } from './demo';
import { OrderStatus as S } from '@/lib/order-status-type';

export const GUIDE_ORDER_ID = 'DEMO-1001';
export const stationStatuses: S[] = [
  S.RECEIVED,
  S.PROCESSING,
  S.READY,
  S.IN_TRANSIT,
  S.INSTALLATION,
  S.COMPLETED,
];

export function departureBlockers(order: DemoOrder) {
  return blockers({ ...order, status: S.READY }, S.IN_TRANSIT, '');
}

export function canDispatch(order: DemoOrder) {
  return order.status === S.READY && blockers(order, S.IN_TRANSIT, '').length === 0;
}

export function benchState(order: DemoOrder) {
  const status =
    order.status === S.ON_HOLD || order.status === S.CANCELLED
      ? order.previousStatus || S.RECEIVED
      : order.status;
  return {
    station: Math.max(0, stationStatuses.indexOf(status)),
    held: order.status === S.ON_HOLD,
    cancelled: order.status === S.CANCELLED,
    gateOpen:
      stationStatuses.indexOf(status) >= 2 &&
      order.status !== S.ON_HOLD &&
      order.status !== S.CANCELLED &&
      departureBlockers(order).length === 0,
    paidFraction:
      order.totalCents === 0
        ? 1
        : Math.max(0, Math.min(1, order.paidAmountCents / order.totalCents)),
  };
}

export const guideSteps = [
  {
    key: 'received',
    title: 'מתחילים בהזמנה אחת',
    body: 'זו הזמנה פיקטיבית. העבירו אותה לטיפול כדי להתחיל להכין אותה ללקוח.',
    field: 'status',
  },
  {
    key: 'prepare',
    title: 'קודם מכינים, אחר כך מתקדמים',
    body: 'המעבר למוכן חסום עד שהפריטים מוכנים. סמנו את ההכנה ואז העבירו למוכן.',
    field: 'items',
  },
  {
    key: 'schedule',
    title: 'קובעים מתי ההזמנה תצא',
    body: 'בחרו מועד אספקה. המחסום יישאר סגור כל עוד חסר גם תשלום מלא.',
    field: 'schedule',
  },
  {
    key: 'payment',
    title: 'מסירים את חסם התשלום',
    body: 'המועד נקבע. סמנו תשלום מלא לצורך הדגמה בלבד — אין כאן חיוב אמיתי.',
    field: 'payment',
  },
  {
    key: 'departure',
    title: 'הכול מוכן ליציאה',
    body: 'הפריטים מוכנים, יש מועד והתשלום סומן. המחסום פתוח ואפשר לצאת למשלוח.',
    field: 'status',
  },
  {
    key: 'delivery',
    title: 'מסיימים עם מסירה ללקוח',
    body: 'ההזמנה בדרך. השלימו את המסירה ובדקו איך כל פעולה נשמרה בהיסטוריה.',
    field: 'status',
  },
  {
    key: 'done',
    title: 'הזמנה אחת. תהליך שלם.',
    body: 'עברתם מקבלת הזמנה למסירה, בלי לדלג על מה שחסר. עכשיו אפשר ליצור הזמנה פיקטיבית משלכם.',
    field: 'done',
  },
] as const;

export function guideIndex(order: DemoOrder) {
  switch (order.status) {
    case S.RECEIVED:
      return 0;
    case S.PROCESSING:
      return 1;
    case S.READY:
      if (!order.scheduledAt) return 2;
      if (departureBlockers(order).length) return 3;
      return 4;
    case S.IN_TRANSIT:
    case S.INSTALLATION:
      return 5;
    case S.COMPLETED:
      return 6;
    default:
      return 0;
  }
}

export function nextStatus(order: DemoOrder): S | undefined {
  if (order.status === S.ON_HOLD) return order.previousStatus;
  return (
    {
      RECEIVED: S.PROCESSING,
      PROCESSING: S.READY,
      READY: S.IN_TRANSIT,
      IN_TRANSIT: S.COMPLETED,
      INSTALLATION: S.COMPLETED,
    } as Partial<Record<S, S>>
  )[order.status];
}
