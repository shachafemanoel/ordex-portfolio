import { LucideIcon, Package, FileText, CheckCircle, Truck } from 'lucide-react';

export enum WorkflowStage {
  NEW = 'NEW',
  IN_PREPARATION = 'IN_PREPARATION',
  READY = 'READY',
  SENT = 'SENT',
}

export enum WorkflowLabel {
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

export interface StageMetadata {
  id: WorkflowStage;
  labelHe: string;
  labelEn: string;
  color: string;
  icon: LucideIcon;
  allowedLabels: WorkflowLabel[];
}

export const WORKFLOW_STAGES: Record<WorkflowStage, StageMetadata> = {
  [WorkflowStage.NEW]: {
    id: WorkflowStage.NEW,
    labelHe: 'חדש',
    labelEn: 'New',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: FileText,
    allowedLabels: [
      WorkflowLabel.AWAITING_PAYMENT,
      WorkflowLabel.CALLBACK_CUSTOMER,
      WorkflowLabel.MISSING_DETAILS,
      WorkflowLabel.APPROVED_TO_START,
    ],
  },
  [WorkflowStage.IN_PREPARATION]: {
    id: WorkflowStage.IN_PREPARATION,
    labelHe: 'בהכנה',
    labelEn: 'In Preparation',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: Package,
    allowedLabels: [
      WorkflowLabel.STOCK_CHECKED,
      WorkflowLabel.PURCHASE_ORDERED,
      WorkflowLabel.AWAITING_GOODS,
      WorkflowLabel.PARTIALLY_RECEIVED,
      WorkflowLabel.READY_FOR_COORDINATION,
    ],
  },
  [WorkflowStage.READY]: {
    id: WorkflowStage.READY,
    labelHe: 'מוכן',
    labelEn: 'Ready',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle,
    allowedLabels: [
      WorkflowLabel.DELIVERY_SCHEDULED,
      WorkflowLabel.INSTALLATION_SCHEDULED,
      WorkflowLabel.AWAITING_DRIVER,
      WorkflowLabel.AWAITING_TECHNICIAN,
    ],
  },
  [WorkflowStage.SENT]: {
    id: WorkflowStage.SENT,
    labelHe: 'נשלח / היסטוריה',
    labelEn: 'Sent / History',
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: Truck,
    allowedLabels: [],
  },
};

export const WORKFLOW_LABELS: Record<WorkflowLabel, { labelHe: string; labelEn: string; color: string }> = {
  [WorkflowLabel.AWAITING_PAYMENT]: { labelHe: 'ממתין לתשלום', labelEn: 'Awaiting Payment', color: 'bg-red-100 text-red-800' },
  [WorkflowLabel.CALLBACK_CUSTOMER]: { labelHe: 'לחזור ללקוח', labelEn: 'Callback Customer', color: 'bg-yellow-100 text-yellow-800' },
  [WorkflowLabel.MISSING_DETAILS]: { labelHe: 'פרטים חסרים', labelEn: 'Missing Details', color: 'bg-orange-100 text-orange-800' },
  [WorkflowLabel.APPROVED_TO_START]: { labelHe: 'מאושר לביצוע', labelEn: 'Approved to Start', color: 'bg-green-100 text-green-800' },

  [WorkflowLabel.STOCK_CHECKED]: { labelHe: 'מלאי נבדק', labelEn: 'Stock Checked', color: 'bg-blue-100 text-blue-800' },
  [WorkflowLabel.PURCHASE_ORDERED]: { labelHe: 'הוזמן רכש', labelEn: 'Purchase Ordered', color: 'bg-indigo-100 text-indigo-800' },
  [WorkflowLabel.AWAITING_GOODS]: { labelHe: 'ממתין לסחורה', labelEn: 'Awaiting Goods', color: 'bg-amber-100 text-amber-800' },
  [WorkflowLabel.PARTIALLY_RECEIVED]: { labelHe: 'התקבל חלקית', labelEn: 'Partially Received', color: 'bg-orange-100 text-orange-800' },
  [WorkflowLabel.READY_FOR_COORDINATION]: { labelHe: 'מוכן לתיאום', labelEn: 'Ready for Coordination', color: 'bg-teal-100 text-teal-800' },

  [WorkflowLabel.DELIVERY_SCHEDULED]: { labelHe: 'משלוח תואם', labelEn: 'Delivery Scheduled', color: 'bg-sky-100 text-sky-800' },
  [WorkflowLabel.INSTALLATION_SCHEDULED]: { labelHe: 'התקנה תואמה', labelEn: 'Installation Scheduled', color: 'bg-cyan-100 text-cyan-800' },
  [WorkflowLabel.AWAITING_DRIVER]: { labelHe: 'ממתין לנהג', labelEn: 'Awaiting Driver', color: 'bg-purple-100 text-purple-800' },
  [WorkflowLabel.AWAITING_TECHNICIAN]: { labelHe: 'ממתין לטכנאי', labelEn: 'Awaiting Technician', color: 'bg-pink-100 text-pink-800' },
};

export function mapLegacyStatusToStage(status: string): WorkflowStage {
  const upper = status.toUpperCase();
  switch (upper) {
    case 'TO_DO':
    case 'RECEIVED':
    case 'PENDING_APPROVAL':
    case 'CALL_BACK':
    case 'DRAFT':
    case 'NEW':
      return WorkflowStage.NEW;

    case 'PROCESSING':
    case 'AWAITING_STOCK':
    case 'PO_CREATED':
    case 'PARTIALLY_SUPPLIED':
    case 'IN_PREPARATION':
      return WorkflowStage.IN_PREPARATION;

    case 'READY':
    case 'READY_FOR_INSTALL':
    case 'INSTALL_SCHEDULING':
    case 'AWAITING_INSTALL':
    case 'SCHEDULED':
      return WorkflowStage.READY;

    case 'IN_TRANSIT':
    case 'INSTALLATION':
    case 'COMPLETED':
    case 'SUPPLIED':
    case 'INVOICED':
    case 'CLOSED':
    case 'CANCELLED':
    case 'REFUNDED':
    case 'SENT':
      return WorkflowStage.SENT;

    default:
      return WorkflowStage.NEW;
  }
}

export function getStageMetadata(stage: WorkflowStage): StageMetadata {
  return WORKFLOW_STAGES[stage];
}

export function getLabelsForStage(stage: WorkflowStage): WorkflowLabel[] {
  return WORKFLOW_STAGES[stage].allowedLabels;
}

export function getLabelMetadata(label: WorkflowLabel) {
  return WORKFLOW_LABELS[label];
}
