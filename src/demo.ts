import { OrderStatus } from "@/lib/order-status-type";
import { validateTransition } from "@/lib/status-machine";
import { executeGuards } from "@/lib/status-guards";
import { getStatusLabel, getTransitionTargets } from "@/lib/orderStatus";

export type DemoOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  product: string;
  totalCents: number;
  paidAmountCents: number;
  paymentStatus: string;
  status: OrderStatus;
  previousStatus?: OrderStatus;
  items: { allocationStatus: string }[];
  shippingAddress: { city: string; street: string; number: string };
  scheduledAt: string;
  history: { label: string; at: string }[];
};
export const record = (label: string) => ({
  label,
  at: new Date().toISOString(),
});
export const money = (cents: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export function createOrder(
  id: string,
  customerName: string,
  product: string,
  totalCents: number,
): DemoOrder {
  return {
    id,
    customerName,
    product,
    totalCents,
    customerPhone: "0000000000",
    paidAmountCents: 0,
    paymentStatus: "PENDING",
    status: OrderStatus.RECEIVED,
    items: [{ allocationStatus: "PENDING" }],
    shippingAddress: { city: "עיר הדגמה", street: "רחוב הדגמה", number: "1" },
    scheduledAt: "",
    history: [record("ההזמנה נוצרה בסביבת ההדגמה")],
  };
}
export function initialOrders(): DemoOrder[] {
  return [
    createOrder("DEMO-1001", "לקוח הדגמה א׳", "שולחן אוכל אלון", 245000),
    {
      ...createOrder("DEMO-1002", "לקוח הדגמה ב׳", "כורסה מרופדת", 189000),
      status: OrderStatus.PROCESSING,
      history: [record("נתון התחלתי: הזמנה בטיפול")],
    },
    {
      ...createOrder("DEMO-1003", "לקוח הדגמה ג׳", "ספרייה מודולרית", 320000),
      status: OrderStatus.READY,
      items: [{ allocationStatus: "ALLOCATED" }],
      history: [record("נתון התחלתי: הזמנה מוכנה")],
    },
  ];
}
export function targets(order: DemoOrder): OrderStatus[] {
  const allowed = getTransitionTargets(order.status);
  return order.status === OrderStatus.ON_HOLD
    ? allowed.filter(
        (status) =>
          status === order.previousStatus || status === OrderStatus.CANCELLED,
      )
    : allowed;
}
export function blockers(
  order: DemoOrder,
  target: OrderStatus,
  reason: string,
): string[] {
  if (
    !validateTransition(order.status, target).isValid ||
    !targets(order).includes(target)
  )
    return ["המעבר אינו אפשרי מהמצב הנוכחי"];
  return executeGuards(order, target, {
    additionalData: { reason },
  }).blockingFailures.map((failure) => failure.message);
}
export function transition(
  order: DemoOrder,
  target: OrderStatus,
  reason: string,
): DemoOrder {
  const errors = blockers(order, target, reason);
  if (errors.length) throw new Error(errors.join("; "));
  return {
    ...order,
    status: target,
    previousStatus: target === OrderStatus.ON_HOLD ? order.status : undefined,
    history: [
      ...order.history,
      record(
        `${getStatusLabel(order.status)} ← ${getStatusLabel(target)}${reason.trim() ? `: ${reason.trim()}` : ""}`,
      ),
    ],
  };
}
