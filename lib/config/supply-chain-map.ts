import {
  CheckCircle,
  FileCheck,
  FileText,
  Hammer,
  MessageSquare,
  Package,
  Phone,
  Receipt,
  Send,
  ShoppingCart,
  TrendingUp,
  Truck,
  Upload,
  UserPlus,
  X,
  Calendar,
  AlertCircle,
  Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SupplyStage, StageMetadata, STAGE_METADATA } from '@/lib/supply-chain/stages';
import { OrderStatus, UserRole, type Order } from '@prisma/client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ActionType =
  | 'status_change'
  | 'create_task'
  | 'create_po'
  | 'schedule'
  | 'send_notification'
  | 'navigate'
  | 'bulk_update'
  | 'export_report'
  | 'upload_media';

export type ActionVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

export interface StageAction {
  id: string;
  label: string; // Hebrew label
  labelEn: string; // English for debugging/logging
  icon: LucideIcon;
  type: ActionType;
  variant: ActionVariant;
  requiresConfirmation: boolean;
  allowBulk: boolean; // Can be applied to multiple orders

  // Parameters for action execution
  params?: {
    toStatus?: OrderStatus;
    taskType?: string;
    templateType?: string;
    [key: string]: any;
  };

  // RBAC - which roles can perform this action
  allowedRoles: UserRole[];

  // Conditional visibility - only show if condition met
  condition?: (order: Order) => boolean;
}

export interface StageKPI {
  key: string;
  label: string; // Hebrew
  labelEn: string;
  description: string; // Hebrew
  icon: LucideIcon;
  valueFormatter?: (value: number) => string;
}

export interface StageQuickFilter {
  key: string;
  label: string; // Hebrew
  labelEn: string;
  filter: {
    priority?: string[];
    paymentStatus?: string[];
    overdueSLA?: boolean;
    [key: string]: any;
  };
}

export interface StageConfig extends StageMetadata {
  actions: StageAction[];
  kpis: StageKPI[];
  defaultSort: 'createdAt:asc' | 'createdAt:desc' | 'priority:desc' | 'updatedAt:desc';
  quickFilters: StageQuickFilter[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Default value formatter for KPIs
 */
export const formatKPIValue = (value: number, type: 'count' | 'percent' | 'currency' | 'days' = 'count'): string => {
  switch (type) {
    case 'count':
      return value.toLocaleString('he-IL');
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'currency':
      return `₪${(value / 100).toLocaleString('he-IL', { minimumFractionDigits: 2 })}`;
    case 'days':
      return `${value.toFixed(0)} ימים`;
    default:
      return value.toString();
  }
};

// ============================================================================
// SUPPLY CHAIN MAP CONFIGURATION
// ============================================================================

export const SUPPLY_CHAIN_MAP: Record<SupplyStage, StageConfig> = {
  // ==========================================================================
  // INTAKE STAGE
  // ==========================================================================
  [SupplyStage.RECEIVED]: {
    ...STAGE_METADATA[SupplyStage.RECEIVED],

    actions: [
      {
        id: 'intake_approve',
        label: 'אישור הזמנה',
        labelEn: 'Approve Order',
        icon: CheckCircle,
        type: 'status_change',
        variant: 'success',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          toStatus: OrderStatus.CONFIRMED,
        },
        allowedRoles: [UserRole.ADMIN, UserRole.SALES, UserRole.OPERATIONS],
        condition: (order: Order) => order.status === OrderStatus.PENDING_APPROVAL,
      },
      {
        id: 'intake_assign_rep',
        label: 'שיוך לנציג',
        labelEn: 'Assign Representative',
        icon: UserPlus,
        type: 'bulk_update',
        variant: 'primary',
        requiresConfirmation: false,
        allowBulk: true,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.SALES, UserRole.OPERATIONS],
      },
      {
        id: 'intake_call_back',
        label: 'חזרה ללקוח',
        labelEn: 'Call Back Customer',
        icon: Phone,
        type: 'status_change',
        variant: 'warning',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          toStatus: OrderStatus.CALL_BACK,
        },
        allowedRoles: [UserRole.ADMIN, UserRole.SALES],
      },
      {
        id: 'intake_reject',
        label: 'דחיית הזמנה',
        labelEn: 'Reject Order',
        icon: X,
        type: 'status_change',
        variant: 'danger',
        requiresConfirmation: true,
        allowBulk: false,
        params: {
          toStatus: OrderStatus.CANCELLED,
        },
        allowedRoles: [UserRole.ADMIN, UserRole.SALES],
      },
      {
        id: 'intake_create_task',
        label: 'יצירת משימה',
        labelEn: 'Create Task',
        icon: FileText,
        type: 'create_task',
        variant: 'secondary',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          taskType: 'OTHER',
        },
        allowedRoles: [UserRole.ADMIN, UserRole.SALES, UserRole.OPERATIONS],
      },
    ],

    kpis: [
      {
        key: 'total_orders',
        label: 'הזמנות בקליטה',
        labelEn: 'Orders in Intake',
        description: 'סה״כ הזמנות שממתינות לטיפול',
        icon: FileText,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'avg_age',
        label: 'זמן ממוצע בשלב',
        labelEn: 'Average Age',
        description: 'זמן ממוצע שהזמנות נמצאות בקליטה',
        icon: Clock,
        valueFormatter: (value: number) => formatKPIValue(value, 'days'),
      },
      {
        key: 'priority_orders',
        label: 'הזמנות דחופות',
        labelEn: 'Priority Orders',
        description: 'הזמנות בעדיפות גבוהה או דחופה',
        icon: AlertCircle,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'sla_compliance',
        label: 'עמידה ב-SLA',
        labelEn: 'SLA Compliance',
        description: 'אחוז ההזמנות שעומדות ב-SLA',
        icon: TrendingUp,
        valueFormatter: (value: number) => formatKPIValue(value, 'percent'),
      },
    ],

    defaultSort: 'priority:desc',

    quickFilters: [
      {
        key: 'pending_approval',
        label: 'ממתין לאישור',
        labelEn: 'Pending Approval',
        filter: {
          priority: ['HIGH', 'URGENT'],
        },
      },
      {
        key: 'callback_needed',
        label: 'דרוש חזרה ללקוח',
        labelEn: 'Callback Needed',
        filter: {
          overdueSLA: true,
        },
      },
    ],
  },

  // ==========================================================================
  // PROCUREMENT STAGE
  // ==========================================================================
  [SupplyStage.PROCESSING]: {
    ...STAGE_METADATA[SupplyStage.PROCESSING],

    actions: [
      {
        id: 'procurement_create_po',
        label: 'יצירת הזמנת רכש',
        labelEn: 'Create Purchase Order',
        icon: ShoppingCart,
        type: 'create_po',
        variant: 'primary',
        requiresConfirmation: false,
        allowBulk: true,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.PURCHASING],
      },
      {
        id: 'procurement_request_quote',
        label: 'בקשת הצעת מחיר',
        labelEn: 'Request Quote',
        icon: MessageSquare,
        type: 'send_notification',
        variant: 'secondary',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          templateType: 'RFQ',
        },
        allowedRoles: [UserRole.ADMIN, UserRole.PURCHASING],
      },
      {
        id: 'procurement_update_supplier',
        label: 'עדכון ספק',
        labelEn: 'Update Supplier',
        icon: Package,
        type: 'bulk_update',
        variant: 'secondary',
        requiresConfirmation: false,
        allowBulk: true,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.PURCHASING],
      },
      {
        id: 'procurement_mark_awaiting',
        label: 'סימון כממתין למלאי',
        labelEn: 'Mark Awaiting Stock',
        icon: Clock,
        type: 'status_change',
        variant: 'warning',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          toStatus: OrderStatus.AWAITING_STOCK,
        },
        allowedRoles: [UserRole.ADMIN, UserRole.PURCHASING, UserRole.OPERATIONS],
      },
      {
        id: 'procurement_split_order',
        label: 'פיצול הזמנה',
        labelEn: 'Split Order',
        icon: FileText,
        type: 'navigate',
        variant: 'secondary',
        requiresConfirmation: true,
        allowBulk: false,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.PURCHASING],
      },
    ],

    kpis: [
      {
        key: 'total_orders',
        label: 'הזמנות ברכש',
        labelEn: 'Orders in Procurement',
        description: 'סה״כ הזמנות הממתינות לרכישת ציוד',
        icon: Package,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'avg_age',
        label: 'זמן ממוצע בשלב',
        labelEn: 'Average Age',
        description: 'זמן ממוצע שהזמנות נמצאות ברכש',
        icon: Clock,
        valueFormatter: (value: number) => formatKPIValue(value, 'days'),
      },
      {
        key: 'pending_pos',
        label: 'הזמנות רכש פתוחות',
        labelEn: 'Pending POs',
        description: 'מספר הזמנות הרכש שטרם הושלמו',
        icon: ShoppingCart,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'total_value',
        label: 'שווי כולל',
        labelEn: 'Total Value',
        description: 'שווי כולל של הזמנות ברכש',
        icon: TrendingUp,
        valueFormatter: (value: number) => formatKPIValue(value, 'currency'),
      },
    ],

    defaultSort: 'createdAt:asc',

    quickFilters: [
      {
        key: 'po_needed',
        label: 'דרוש יצירת הז״ר',
        labelEn: 'PO Needed',
        filter: {},
      },
      {
        key: 'awaiting_stock',
        label: 'ממתין למלאי',
        labelEn: 'Awaiting Stock',
        filter: {},
      },
    ],
  },

  // ==========================================================================
  // RECEIVING STAGE
  // ==========================================================================
  [SupplyStage.READY]: {
    ...STAGE_METADATA[SupplyStage.READY],

    actions: [
      {
        id: 'receiving_record_receipt',
        label: 'רישום קבלת סחורה',
        labelEn: 'Record Receipt',
        icon: Receipt,
        type: 'navigate',
        variant: 'primary',
        requiresConfirmation: false,
        allowBulk: false,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.PURCHASING, UserRole.OPERATIONS],
      },
      {
        id: 'receiving_mark_partial',
        label: 'סימון כסופק חלקי',
        labelEn: 'Mark Partial',
        icon: Package,
        type: 'status_change',
        variant: 'warning',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          toStatus: OrderStatus.PARTIALLY_SUPPLIED,
        },
        allowedRoles: [UserRole.ADMIN, UserRole.PURCHASING, UserRole.OPERATIONS],
      },
      {
        id: 'receiving_mark_ready',
        label: 'סימון כמוכן להתקנה',
        labelEn: 'Mark Ready for Installation',
        icon: CheckCircle,
        type: 'status_change',
        variant: 'success',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          toStatus: OrderStatus.INSTALL_SCHEDULING,
        },
        allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONS],
      },
      {
        id: 'receiving_report_quality',
        label: 'דיווח בעיה באיכות',
        labelEn: 'Report Quality Issue',
        icon: AlertCircle,
        type: 'create_task',
        variant: 'danger',
        requiresConfirmation: false,
        allowBulk: false,
        params: {
          taskType: 'OTHER',
        },
        allowedRoles: [UserRole.ADMIN, UserRole.PURCHASING, UserRole.OPERATIONS],
      },
      {
        id: 'receiving_upload_photos',
        label: 'העלאת תמונות',
        labelEn: 'Upload Photos',
        icon: Upload,
        type: 'upload_media',
        variant: 'secondary',
        requiresConfirmation: false,
        allowBulk: false,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.PURCHASING, UserRole.OPERATIONS, UserRole.INSTALLER],
      },
    ],

    kpis: [
      {
        key: 'total_orders',
        label: 'הזמנות בקבלה',
        labelEn: 'Orders in Receiving',
        description: 'סה״כ הזמנות הממתינות לקליטת סחורה',
        icon: Truck,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'avg_age',
        label: 'זמן ממוצע בשלב',
        labelEn: 'Average Age',
        description: 'זמן ממוצע שהזמנות נמצאות בקבלה',
        icon: Clock,
        valueFormatter: (value: number) => formatKPIValue(value, 'days'),
      },
      {
        key: 'partial_receipts',
        label: 'קבלות חלקיות',
        labelEn: 'Partial Receipts',
        description: 'מספר הזמנות עם קבלה חלקית',
        icon: Package,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'quality_issues',
        label: 'בעיות איכות',
        labelEn: 'Quality Issues',
        description: 'מספר בעיות האיכות שדווחו',
        icon: AlertCircle,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
    ],

    defaultSort: 'createdAt:asc',

    quickFilters: [
      {
        key: 'partial_only',
        label: 'קבלה חלקית בלבד',
        labelEn: 'Partial Only',
        filter: {},
      },
      {
        key: 'ready_for_install',
        label: 'מוכן להתקנה',
        labelEn: 'Ready for Install',
        filter: {},
      },
    ],
  },

  // ==========================================================================
  // SCHEDULING STAGE
  // ==========================================================================
  [SupplyStage.IN_TRANSIT]: {
    ...STAGE_METADATA[SupplyStage.IN_TRANSIT],

    actions: [
      {
        id: 'scheduling_schedule',
        label: 'תזמון התקנה',
        labelEn: 'Schedule Installation',
        icon: Calendar,
        type: 'schedule',
        variant: 'primary',
        requiresConfirmation: false,
        allowBulk: false,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.SALES, UserRole.OPERATIONS],
      },
      {
        id: 'scheduling_assign_tech',
        label: 'שיבוץ טכנאי',
        labelEn: 'Assign Technician',
        icon: UserPlus,
        type: 'bulk_update',
        variant: 'primary',
        requiresConfirmation: false,
        allowBulk: true,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONS],
      },
      {
        id: 'scheduling_send_confirmation',
        label: 'שליחת אישור ללקוח',
        labelEn: 'Send Confirmation',
        icon: Send,
        type: 'send_notification',
        variant: 'secondary',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          templateType: 'INSTALLATION_CONFIRMATION',
        },
        allowedRoles: [UserRole.ADMIN, UserRole.SALES, UserRole.OPERATIONS],
      },
      {
        id: 'scheduling_reschedule',
        label: 'דחיית מועד',
        labelEn: 'Reschedule',
        icon: Calendar,
        type: 'schedule',
        variant: 'warning',
        requiresConfirmation: false,
        allowBulk: false,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.SALES, UserRole.OPERATIONS],
      },
      {
        id: 'scheduling_regional_batch',
        label: 'שיבוץ אזורי',
        labelEn: 'Regional Batch',
        icon: Package,
        type: 'bulk_update',
        variant: 'secondary',
        requiresConfirmation: false,
        allowBulk: true,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONS],
      },
    ],

    kpis: [
      {
        key: 'total_orders',
        label: 'הזמנות בתיאום',
        labelEn: 'Orders in Scheduling',
        description: 'סה״כ הזמנות הממתינות לתזמון',
        icon: Calendar,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'avg_age',
        label: 'זמן ממוצע בשלב',
        labelEn: 'Average Age',
        description: 'זמן ממוצע שהזמנות נמצאות בתיאום',
        icon: Clock,
        valueFormatter: (value: number) => formatKPIValue(value, 'days'),
      },
      {
        key: 'scheduled',
        label: 'מתוזמן',
        labelEn: 'Scheduled',
        description: 'מספר הזמנות שכבר תוזמנו',
        icon: CheckCircle,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'technician_utilization',
        label: 'ניצולת טכנאים',
        labelEn: 'Technician Utilization',
        description: 'אחוז הניצולת של הטכנאים',
        icon: TrendingUp,
        valueFormatter: (value: number) => formatKPIValue(value, 'percent'),
      },
    ],

    defaultSort: 'createdAt:asc',

    quickFilters: [
      {
        key: 'unscheduled',
        label: 'ממתין לתזמון',
        labelEn: 'Unscheduled',
        filter: {},
      },
      {
        key: 'scheduled_this_week',
        label: 'מתוזמן השבוע',
        labelEn: 'Scheduled This Week',
        filter: {},
      },
    ],
  },

  // ==========================================================================
  // EXECUTION STAGE
  // ==========================================================================
  [SupplyStage.INSTALLATION]: {
    ...STAGE_METADATA[SupplyStage.INSTALLATION],

    actions: [
      {
        id: 'execution_mark_ready',
        label: 'סימון כמוכן',
        labelEn: 'Mark Ready',
        icon: CheckCircle,
        type: 'status_change',
        variant: 'success',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          toStatus: OrderStatus.READY_FOR_INSTALL,
        },
        allowedRoles: [UserRole.ADMIN, UserRole.OPERATIONS, UserRole.INSTALLER],
      },
      {
        id: 'execution_start',
        label: 'התחלת התקנה',
        labelEn: 'Start Installation',
        icon: Hammer,
        type: 'status_change',
        variant: 'primary',
        requiresConfirmation: false,
        allowBulk: false,
        params: {
          toStatus: OrderStatus.AWAITING_INSTALL,
        },
        allowedRoles: [UserRole.ADMIN, UserRole.INSTALLER],
      },
      {
        id: 'execution_complete',
        label: 'סיום התקנה',
        labelEn: 'Complete Installation',
        icon: CheckCircle,
        type: 'status_change',
        variant: 'success',
        requiresConfirmation: true,
        allowBulk: false,
        params: {
          toStatus: OrderStatus.SUPPLIED,
        },
        allowedRoles: [UserRole.ADMIN, UserRole.INSTALLER, UserRole.OPERATIONS],
      },
      {
        id: 'execution_report_issue',
        label: 'דיווח בעיה בשטח',
        labelEn: 'Report Field Issue',
        icon: AlertCircle,
        type: 'create_task',
        variant: 'danger',
        requiresConfirmation: false,
        allowBulk: false,
        params: {
          taskType: 'OTHER',
        },
        allowedRoles: [UserRole.ADMIN, UserRole.INSTALLER, UserRole.OPERATIONS],
      },
      {
        id: 'execution_upload_photos',
        label: 'העלאת תמונות',
        labelEn: 'Upload Photos',
        icon: Upload,
        type: 'upload_media',
        variant: 'secondary',
        requiresConfirmation: false,
        allowBulk: false,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.INSTALLER],
      },
    ],

    kpis: [
      {
        key: 'total_orders',
        label: 'הזמנות בביצוע',
        labelEn: 'Orders in Execution',
        description: 'סה״כ הזמנות בתהליך התקנה',
        icon: Hammer,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'avg_age',
        label: 'זמן ממוצע בשלב',
        labelEn: 'Average Age',
        description: 'זמן ממוצע שהזמנות נמצאות בביצוע',
        icon: Clock,
        valueFormatter: (value: number) => formatKPIValue(value, 'days'),
      },
      {
        key: 'completed_today',
        label: 'הושלמו היום',
        labelEn: 'Completed Today',
        description: 'מספר ההתקנות שהושלמו היום',
        icon: CheckCircle,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'field_issues',
        label: 'בעיות בשטח',
        labelEn: 'Field Issues',
        description: 'מספר הבעיות שדווחו בשטח',
        icon: AlertCircle,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
    ],

    defaultSort: 'priority:desc',

    quickFilters: [
      {
        key: 'in_progress',
        label: 'בתהליך',
        labelEn: 'In Progress',
        filter: {},
      },
      {
        key: 'today_installations',
        label: 'התקנות היום',
        labelEn: "Today's Installations",
        filter: {},
      },
    ],
  },

  // ==========================================================================
  // CLOSURE STAGE
  // ==========================================================================
  [SupplyStage.COMPLETED]: {
    ...STAGE_METADATA[SupplyStage.COMPLETED],

    actions: [
      {
        id: 'closure_generate_invoice',
        label: 'יצירת חשבונית',
        labelEn: 'Generate Invoice',
        icon: Receipt,
        type: 'navigate',
        variant: 'primary',
        requiresConfirmation: false,
        allowBulk: true,
        params: {},
        allowedRoles: [UserRole.ADMIN, UserRole.SALES],
      },
      {
        id: 'closure_mark_paid',
        label: 'סימון כשולם',
        labelEn: 'Mark Paid',
        icon: CheckCircle,
        type: 'status_change',
        variant: 'success',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          toStatus: OrderStatus.COMPLETED,
        },
        allowedRoles: [UserRole.ADMIN, UserRole.SALES],
      },
      {
        id: 'closure_archive',
        label: 'ארכיון',
        labelEn: 'Archive',
        icon: FileCheck,
        type: 'status_change',
        variant: 'secondary',
        requiresConfirmation: true,
        allowBulk: true,
        params: {
          toStatus: OrderStatus.COMPLETED,
        },
        allowedRoles: [UserRole.ADMIN],
      },
      {
        id: 'closure_cancel',
        label: 'ביטול',
        labelEn: 'Cancel',
        icon: X,
        type: 'status_change',
        variant: 'danger',
        requiresConfirmation: true,
        allowBulk: false,
        params: {
          toStatus: OrderStatus.CANCELLED,
        },
        allowedRoles: [UserRole.ADMIN],
      },
      {
        id: 'closure_send_survey',
        label: 'שליחת סקר שביעות רצון',
        labelEn: 'Send Satisfaction Survey',
        icon: Send,
        type: 'send_notification',
        variant: 'secondary',
        requiresConfirmation: false,
        allowBulk: true,
        params: {
          templateType: 'SATISFACTION_SURVEY',
        },
        allowedRoles: [UserRole.ADMIN, UserRole.SALES],
      },
    ],

    kpis: [
      {
        key: 'total_orders',
        label: 'הזמנות בסגירה',
        labelEn: 'Orders in Closure',
        description: 'סה״כ הזמנות בתהליך סגירה',
        icon: CheckCircle,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'avg_age',
        label: 'זמן ממוצע בשלב',
        labelEn: 'Average Age',
        description: 'זמן ממוצע שהזמנות נמצאות בסגירה',
        icon: Clock,
        valueFormatter: (value: number) => formatKPIValue(value, 'days'),
      },
      {
        key: 'pending_invoices',
        label: 'חשבוניות ממתינות',
        labelEn: 'Pending Invoices',
        description: 'מספר ההזמנות שממתינות לחשבונית',
        icon: Receipt,
        valueFormatter: (value: number) => formatKPIValue(value, 'count'),
      },
      {
        key: 'payment_collection',
        label: 'גביית תשלומים',
        labelEn: 'Payment Collection',
        description: 'אחוז ההזמנות ששולמו',
        icon: TrendingUp,
        valueFormatter: (value: number) => formatKPIValue(value, 'percent'),
      },
    ],

    defaultSort: 'updatedAt:desc',

    quickFilters: [
      {
        key: 'pending_invoice',
        label: 'ממתין לחשבונית',
        labelEn: 'Pending Invoice',
        filter: {
          paymentStatus: ['PENDING'],
        },
      },
      {
        key: 'pending_payment',
        label: 'ממתין לתשלום',
        labelEn: 'Pending Payment',
        filter: {
          paymentStatus: ['AUTHORIZED'],
        },
      },
    ],
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get stage configuration by stage ID
 */
export function getStageConfig(stage: SupplyStage): StageConfig {
  return SUPPLY_CHAIN_MAP[stage];
}

/**
 * Get all actions for a specific stage filtered by user role
 */
export function getStageActions(stage: SupplyStage, userRole: UserRole): StageAction[] {
  const config = getStageConfig(stage);
  return config.actions.filter((action) => action.allowedRoles.includes(userRole));
}

/**
 * Get a specific action by ID
 */
export function getActionById(actionId: string): StageAction | undefined {
  for (const stage of Object.values(SUPPLY_CHAIN_MAP)) {
    const action = stage.actions.find((a) => a.id === actionId);
    if (action) return action;
  }
  return undefined;
}

/**
 * Check if user has permission to execute an action
 */
export function canExecuteAction(action: StageAction, userRole: UserRole, order?: Order): boolean {
  // Check role permission
  if (!action.allowedRoles.includes(userRole)) {
    return false;
  }

  // Check condition if provided
  if (order && action.condition && !action.condition(order)) {
    return false;
  }

  return true;
}
