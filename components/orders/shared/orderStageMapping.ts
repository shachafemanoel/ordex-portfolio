export enum OrderStage {
  NEW = 'NEW',
  IN_PREPARATION = 'IN_PREPARATION',
  READY = 'READY',
  SENT = 'SENT',
}

export enum OrderWorkLabel {
  // NEW
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  CALLBACK_CUSTOMER = 'CALLBACK_CUSTOMER',
  MISSING_DETAILS = 'MISSING_DETAILS',
  APPROVED_TO_START = 'APPROVED_TO_START',

  // IN_PREPARATION
  STOCK_CHECKED = 'STOCK_CHECKED',
  PURCHASE_ORDERED = 'PURCHASE_ORDERED',
  AWAITING_GOODS = 'AWAITING_GOODS',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  READY_FOR_COORDINATION = 'READY_FOR_COORDINATION',

  // READY
  DELIVERY_SCHEDULED = 'DELIVERY_SCHEDULED',
  INSTALLATION_SCHEDULED = 'INSTALLATION_SCHEDULED',
  AWAITING_DRIVER = 'AWAITING_DRIVER',
  AWAITING_TECHNICIAN = 'AWAITING_TECHNICIAN',
}

export interface StageConfig {
  id: OrderStage;
  titleHe: string;
  titleEn: string;
  color: string;
  icon: string;
  allowedLabels: OrderWorkLabel[];
}

export const STAGES: StageConfig[] = [
  {
    id: OrderStage.NEW,
    titleHe: 'הזמנות חדשות',
    titleEn: 'New orders',
    color: 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30',
    icon: '🔴',
    allowedLabels: [
      OrderWorkLabel.AWAITING_PAYMENT,
      OrderWorkLabel.CALLBACK_CUSTOMER,
      OrderWorkLabel.MISSING_DETAILS,
      OrderWorkLabel.APPROVED_TO_START,
    ],
  },
  {
    id: OrderStage.IN_PREPARATION,
    titleHe: 'הזמנות בהכנה',
    titleEn: 'In preparation',
    color: 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30',
    icon: '📦',
    allowedLabels: [
      OrderWorkLabel.STOCK_CHECKED,
      OrderWorkLabel.PURCHASE_ORDERED,
      OrderWorkLabel.AWAITING_GOODS,
      OrderWorkLabel.PARTIALLY_RECEIVED,
      OrderWorkLabel.READY_FOR_COORDINATION,
    ],
  },
  {
    id: OrderStage.READY,
    titleHe: 'הזמנות מוכנות',
    titleEn: 'Ready',
    color: 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30',
    icon: '✅',
    allowedLabels: [
      OrderWorkLabel.DELIVERY_SCHEDULED,
      OrderWorkLabel.INSTALLATION_SCHEDULED,
      OrderWorkLabel.AWAITING_DRIVER,
      OrderWorkLabel.AWAITING_TECHNICIAN,
    ],
  },
  {
    id: OrderStage.SENT,
    titleHe: 'נשלחה', // Or 'היסטוריה' for the tab
    titleEn: 'Sent',
    color: 'bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30',
    icon: '💚',
    allowedLabels: [],
  },
];

export const LABEL_CONFIG: Record<OrderWorkLabel, { he: string; en: string; color: string }> = {
  [OrderWorkLabel.AWAITING_PAYMENT]: { he: 'ממתין לתשלום', en: 'Awaiting payment', color: 'bg-red-100 text-red-700' },
  [OrderWorkLabel.CALLBACK_CUSTOMER]: { he: 'לחזור ללקוח', en: 'Call back customer', color: 'bg-yellow-100 text-yellow-700' },
  [OrderWorkLabel.MISSING_DETAILS]: { he: 'פרטים חסרים', en: 'Missing details', color: 'bg-orange-100 text-orange-700' },
  [OrderWorkLabel.APPROVED_TO_START]: { he: 'אושר לתחילת עבודה', en: 'Approved to start', color: 'bg-green-100 text-green-700' },

  [OrderWorkLabel.STOCK_CHECKED]: { he: 'נבדק מלאי', en: 'Stock checked', color: 'bg-blue-100 text-blue-700' },
  [OrderWorkLabel.PURCHASE_ORDERED]: { he: 'הוזמן מספק', en: 'Ordered from supplier', color: 'bg-orange-100 text-orange-700' },
  [OrderWorkLabel.AWAITING_GOODS]: { he: 'ממתין לסחורה', en: 'Awaiting goods', color: 'bg-amber-100 text-amber-700' },
  [OrderWorkLabel.PARTIALLY_RECEIVED]: { he: 'סופק חלקית', en: 'Partially received', color: 'bg-orange-100 text-orange-700' },
  [OrderWorkLabel.READY_FOR_COORDINATION]: { he: 'מוכן לתיאום', en: 'Ready to coordinate', color: 'bg-teal-100 text-teal-700' },

  [OrderWorkLabel.DELIVERY_SCHEDULED]: { he: 'תואם משלוח', en: 'Delivery scheduled', color: 'bg-sky-100 text-sky-700' },
  [OrderWorkLabel.INSTALLATION_SCHEDULED]: { he: 'תואם התקנה', en: 'Installation scheduled', color: 'bg-cyan-100 text-cyan-700' },
  [OrderWorkLabel.AWAITING_DRIVER]: { he: 'ממתין לנהג', en: 'Awaiting driver', color: 'bg-purple-100 text-purple-700' },
  [OrderWorkLabel.AWAITING_TECHNICIAN]: { he: 'ממתין לטכנאי', en: 'Awaiting technician', color: 'bg-pink-100 text-pink-700' },
};

// Mapping from old legacy status to new Stage
export function mapLegacyStatusToStage(status: string): OrderStage {
  switch (status) {
    case 'TO_DO':
    case 'RECEIVED':
    case 'PENDING_APPROVAL':
    case 'CALL_BACK':
      return OrderStage.NEW;

    case 'PROCESSING':
    case 'AWAITING_STOCK':
    case 'PO_CREATED':
    case 'PARTIALLY_SUPPLIED':
      return OrderStage.IN_PREPARATION;

    case 'READY':
    case 'READY_FOR_INSTALL':
    case 'INSTALL_SCHEDULING':
    case 'AWAITING_INSTALL':
    case 'SCHEDULED':
      return OrderStage.READY;

    case 'IN_TRANSIT':
    case 'INSTALLATION':
    case 'COMPLETED':
    case 'SUPPLIED':
    case 'INVOICED':
    case 'CLOSED':
    case 'CANCELLED': // Treat cancelled as history for now? Or separate? Spec says SENT -> History.
      return OrderStage.SENT;

    default:
      return OrderStage.NEW; // Fallback
  }
}

export function getInitialLabelsForLegacyStatus(status: string): OrderWorkLabel[] {
  switch (status) {
    case 'CALL_BACK': return [OrderWorkLabel.CALLBACK_CUSTOMER];
    case 'PO_CREATED': return [OrderWorkLabel.PURCHASE_ORDERED];
    case 'AWAITING_STOCK': return [OrderWorkLabel.AWAITING_GOODS];
    case 'PARTIALLY_SUPPLIED': return [OrderWorkLabel.PARTIALLY_RECEIVED];
    case 'SCHEDULED': return [OrderWorkLabel.INSTALLATION_SCHEDULED]; 
    case 'INSTALL_SCHEDULING': return [OrderWorkLabel.READY_FOR_COORDINATION];
    default: return [];
  }
}
