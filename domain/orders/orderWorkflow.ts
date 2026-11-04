import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  normalizeOrderStatus,
} from '@/lib/orderStatus';
import type { OrderStatus } from '@prisma/client';
import type {
  OrderCalendarEventDTO,
  OrderCustomerSummary,
  OrderItemDTO,
  OrderPaymentDTO,
  OrderPurchaseOrderSummary,
  OrderShipmentDTO,
} from './orderDTO';

export interface WorkflowRequirement {
  id: string;
  label: string;
  satisfied: boolean;
  blocking: boolean;
}

export interface WorkflowAction {
  id: string;
  label: string;
  href?: string;
  intent?: 'primary' | 'secondary';
}

export interface WorkflowTransitionState {
  target: OrderStatus;
  stageLabel: string;
  requirements: WorkflowRequirement[];
}

export interface OrderWorkflowState {
  status: OrderStatus;
  stageLabel: string;
  description: string;
  requirements: WorkflowRequirement[];
  allowedNext: OrderStatus[];
  transitions: WorkflowTransitionState[];
  actions: WorkflowAction[];
}

export interface OrderWorkflowContext {
  outstandingBalance: number;
  purchaseOrders: OrderPurchaseOrderSummary[];
  calendarEvents: OrderCalendarEventDTO[];
  shipments: OrderShipmentDTO[];
}

export interface OrderWorkflowSnapshot {
  id: string;
  number: string;
  status: OrderStatus;
  statusRaw?: string;
  customer: OrderCustomerSummary | null;
  items: Array<
    Pick<OrderItemDTO, 'id' | 'name' | 'quantity' | 'pricePerUnit' | 'total' | 'received'>
  >;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  notesCount?: number;
  purchaseOrders: OrderPurchaseOrderSummary[];
  expectedStockAt?: string | null;
  calendarEvents: OrderCalendarEventDTO[];
  shipments: OrderShipmentDTO[];
  payments: Array<Pick<OrderPaymentDTO, 'id' | 'amount' | 'paidAt'>>;
  outstandingBalance: number;
}

type RequirementEvaluator = (snapshot: OrderWorkflowSnapshot) => boolean;

interface RequirementBlueprint {
  id: string;
  label: string;
  blocking?: boolean;
  evaluate: RequirementEvaluator;
}

const requirementEvaluators: Record<string, RequirementEvaluator> = {
  customer_profile: (snapshot) => Boolean(snapshot.customer?.phone || snapshot.customer?.email),
  contact_notes: (snapshot) => (snapshot.notesCount ?? 0) > 0,
  purchase_orders: (snapshot) => snapshot.purchaseOrders.length > 0,
  expected_arrival: (snapshot) =>
    snapshot.purchaseOrders.some((po) => Boolean(po.expectedAt)) ||
    Boolean(snapshot.expectedStockAt),
  receiving_started: (snapshot) => snapshot.items.some((item) => item.received),
  all_items_available: (snapshot) =>
    snapshot.items.length > 0 && snapshot.items.every((item) => item.received),
  calendar_event: (snapshot) => snapshot.calendarEvents.length > 0,
  shipments_completed: (snapshot) =>
    snapshot.shipments.length > 0 &&
    snapshot.shipments.every((shipment) =>
      ['DELIVERED', 'COMPLETED', 'INSTALLED'].includes((shipment.status || '').toUpperCase())
    ),
  payments_complete: (snapshot) => snapshot.outstandingBalance <= 0.5,
};

const customerProfileReq: RequirementBlueprint = {
  id: 'customer_profile',
  label: 'פרטי לקוח מלאים',
  evaluate: requirementEvaluators.customer_profile,
};
const contactNotesReq: RequirementBlueprint = {
  id: 'contact_notes',
  label: 'תיעוד שיחת מעקב/הערות',
  evaluate: requirementEvaluators.contact_notes,
};
const purchaseOrdersReq: RequirementBlueprint = {
  id: 'purchase_orders',
  label: 'הזמנת רכש משויכת להזמנה',
  evaluate: requirementEvaluators.purchase_orders,
};
const expectedArrivalReq: RequirementBlueprint = {
  id: 'expected_arrival',
  label: 'תיעוד צפי אספקה',
  evaluate: requirementEvaluators.expected_arrival,
};
const receivingStartedReq: RequirementBlueprint = {
  id: 'receiving_started',
  label: 'קליטת מלאי התחילה',
  evaluate: requirementEvaluators.receiving_started,
};
const allItemsAvailableReq: RequirementBlueprint = {
  id: 'all_items_available',
  label: 'כל הפריטים זמינים במחסן',
  blocking: true,
  evaluate: requirementEvaluators.all_items_available,
};
const calendarEventReq: RequirementBlueprint = {
  id: 'calendar_event',
  label: 'אירוע יומן מתוזמן',
  blocking: true,
  evaluate: requirementEvaluators.calendar_event,
};
const shipmentsCompletedReq: RequirementBlueprint = {
  id: 'shipments_completed',
  label: 'משלוחים/התקנה סומנו כהושלמו',
  evaluate: requirementEvaluators.shipments_completed,
};
const paymentsCompleteReq: RequirementBlueprint = {
  id: 'payments_complete',
  label: 'תשלום הושלם',
  blocking: true,
  evaluate: requirementEvaluators.payments_complete,
};

const STATUS_REQUIREMENTS: Partial<Record<OrderStatus, RequirementBlueprint[]>> = {
  DRAFT: [customerProfileReq],
  PENDING_APPROVAL: [customerProfileReq, contactNotesReq],
  CONFIRMED: [customerProfileReq, purchaseOrdersReq, expectedArrivalReq],
  PO_CREATED: [purchaseOrdersReq],
  AWAITING_STOCK: [purchaseOrdersReq, expectedArrivalReq],
  READY_FOR_INSTALL: [allItemsAvailableReq],
  SCHEDULED: [calendarEventReq],
  COMPLETED: [shipmentsCompletedReq],
  INVOICED: [paymentsCompleteReq],
  CANCELLED: [],
};

const STATUS_DESCRIPTIONS: Partial<Record<OrderStatus, string>> = {
  DRAFT: 'הזמנה בתהליך קליטת נתונים ובדיקת פרטי הלקוח.',
  PENDING_APPROVAL: 'הזמנה ממתינה לאישור מנהל.',
  CONFIRMED: 'הפרטים אושרו וממתינים למלאי/תיאומים.',
  AWAITING_STOCK: 'ממתין למלאי מהספק, נדרש צפי אספקה מעודכן.',
  PO_CREATED: 'הזמנת רכש נפתחה וממתינים לאספקה.',
  READY_FOR_INSTALL: 'כל הפריטים זמינים וניתן לתאם התקנה.',
  SCHEDULED: 'אירוע ההתקנה נקבע ביומן.',
  COMPLETED: 'ההתקנה בוצעה, נותר טיפול כספי/מסמכים.',
  INVOICED: 'החשבונית נשלחה, ויתרת החוב נסגרת.',
  CANCELLED: 'ההזמנה בוטלה.',
};

const DEFAULT_ACTIONS = (orderId: string): WorkflowAction[] => [
  {
    id: 'open-receiving',
    label: 'עדכן קליטת מלאי',
    href: `/receiving?orderId=${orderId}`,
    intent: 'primary',
  },
  {
    id: 'open-purchase-order',
    label: 'צור הזמנת רכש',
    href: `/purchase-orders/new?orderId=${orderId}`,
  },
  {
    id: 'open-calendar',
    label: 'פתח ביומן התקנות',
    href: `/calendar?orderId=${orderId}`,
  },
  {
    id: 'open-payments',
    label: 'תשלומים וגבייה',
    href: `/payments?orderId=${orderId}`,
  },
];

function evaluateRequirement(
  blueprint: RequirementBlueprint,
  snapshot: OrderWorkflowSnapshot
): WorkflowRequirement {
  return {
    id: blueprint.id,
    label: blueprint.label,
    blocking: blueprint.blocking ?? false,
    satisfied: blueprint.evaluate(snapshot),
  };
}

function buildRequirementsForStatus(
  status: OrderStatus,
  snapshot: OrderWorkflowSnapshot
): WorkflowRequirement[] {
  const blueprints = STATUS_REQUIREMENTS[status];
  if (!blueprints || blueprints.length === 0) {
    return [];
  }
  return blueprints.map((blueprint) => evaluateRequirement(blueprint, snapshot));
}

function buildTransitions(snapshot: OrderWorkflowSnapshot): WorkflowTransitionState[] {
  const currentStatus = normalizeOrderStatus(snapshot.status);
  const targets = ORDER_STATUS_TRANSITIONS[currentStatus] ?? [];
  return targets.map((target) => ({
    target,
    stageLabel: ORDER_STATUS_LABELS[target],
    requirements: buildRequirementsForStatus(target, snapshot),
  }));
}

export function evaluateWorkflow(snapshot: OrderWorkflowSnapshot): OrderWorkflowState {
  const status = normalizeOrderStatus(snapshot.status);
  const requirements = buildRequirementsForStatus(status, snapshot);
  const allowedNext = ORDER_STATUS_TRANSITIONS[status] ?? [];

  return {
    status,
    stageLabel: ORDER_STATUS_LABELS[status],
    description: STATUS_DESCRIPTIONS[status] ?? `סטטוס נוכחי: ${ORDER_STATUS_LABELS[status]}`,
    requirements,
    allowedNext,
    transitions: buildTransitions(snapshot),
    actions: DEFAULT_ACTIONS(snapshot.id),
  };
}
