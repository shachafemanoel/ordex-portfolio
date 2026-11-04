export type QuickActionSurface = 'row' | 'page' | 'bulk' | 'drawer';
export type QuickActionVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';

export interface QuickAction {
  id: string;
  labelHe: string;
  icon: any; // LucideIcon or string name if we map it later, but importing directly is easier for now if this is client-side.
  // However, status-config uses strings. To keep it consistent, let's use strings or a map.
  // Plan said: "Each action has ... icon".
  // Let's use the string name and a mapper, to align with status-config.
  surface: QuickActionSurface[];
  variant: QuickActionVariant;
}

export const QUICK_ACTIONS: Record<string, QuickAction> = {
  // General / Edit
  edit: {
    id: 'edit',
    labelHe: 'ערוך',
    icon: 'FileEdit',
    surface: ['row', 'page', 'drawer'],
    variant: 'outline',
  },
  delete: {
    id: 'delete',
    labelHe: 'מחק',
    icon: 'Trash2',
    surface: ['row', 'bulk'],
    variant: 'destructive',
  },
  view: { id: 'view', labelHe: 'צפה', icon: 'FileText', surface: ['row'], variant: 'ghost' },
  duplicate: {
    id: 'duplicate',
    labelHe: 'שכפל',
    icon: 'Copy',
    surface: ['row', 'page'],
    variant: 'outline',
  },
  archive: {
    id: 'archive',
    labelHe: 'ארכיון',
    icon: 'Archive',
    surface: ['row', 'bulk'],
    variant: 'secondary',
  },
  restore: {
    id: 'restore',
    labelHe: 'שחזר',
    icon: 'RotateCcw',
    surface: ['row', 'bulk'],
    variant: 'outline',
  },

  // Approval Flow
  submit_for_approval: {
    id: 'submit_for_approval',
    labelHe: 'שלח לאישור',
    icon: 'Send',
    surface: ['page', 'row'],
    variant: 'default',
  },
  approve: {
    id: 'approve',
    labelHe: 'אשר',
    icon: 'CheckCircle',
    surface: ['page', 'row', 'bulk'],
    variant: 'default',
  },
  reject: {
    id: 'reject',
    labelHe: 'דחה',
    icon: 'XCircle',
    surface: ['page', 'row'],
    variant: 'destructive',
  },
  request_changes: {
    id: 'request_changes',
    labelHe: 'בקש שינויים',
    icon: 'MessageSquare',
    surface: ['page'],
    variant: 'outline',
  },

  // Execution
  start: {
    id: 'start',
    labelHe: 'התחל',
    icon: 'Play',
    surface: ['page', 'row'],
    variant: 'default',
  },
  complete: {
    id: 'complete',
    labelHe: 'סיים',
    icon: 'CheckCircle',
    surface: ['page', 'row'],
    variant: 'default',
  },
  cancel: {
    id: 'cancel',
    labelHe: 'בטל',
    icon: 'XCircle',
    surface: ['page', 'row'],
    variant: 'destructive',
  },

  // Communication
  call: {
    id: 'call',
    labelHe: 'התקשר',
    icon: 'Phone',
    surface: ['page', 'row', 'drawer'],
    variant: 'outline',
  },
  send_message: {
    id: 'send_message',
    labelHe: 'שלח הודעה',
    icon: 'MessageSquare',
    surface: ['page', 'row', 'drawer'],
    variant: 'outline',
  },

  // Logistics
  create_po: {
    id: 'create_po',
    labelHe: 'צור הזמנת רכש',
    icon: 'ShoppingCart',
    surface: ['page', 'row'],
    variant: 'default',
  },
  schedule_installation: {
    id: 'schedule_installation',
    labelHe: 'תזמן התקנה',
    icon: 'Calendar',
    surface: ['page', 'row'],
    variant: 'default',
  },
  schedule: {
    id: 'schedule',
    labelHe: 'תזמן',
    icon: 'Calendar',
    surface: ['page', 'row'],
    variant: 'default',
  },
  reschedule: {
    id: 'reschedule',
    labelHe: 'תזמן מחדש',
    icon: 'Calendar',
    surface: ['page', 'row'],
    variant: 'outline',
  },
  create_invoice: {
    id: 'create_invoice',
    labelHe: 'הפק חשבונית',
    icon: 'FileText',
    surface: ['page', 'row'],
    variant: 'default',
  },
  record_payment: {
    id: 'record_payment',
    labelHe: 'רשום תשלום',
    icon: 'CreditCard',
    surface: ['page', 'drawer'],
    variant: 'default',
  },

  // Issues
  report_issue: {
    id: 'report_issue',
    labelHe: 'דווח בעיה',
    icon: 'AlertTriangle',
    surface: ['page'],
    variant: 'destructive',
  },
};

export function getActionConfig(id: string): QuickAction | undefined {
  return QUICK_ACTIONS[id];
}
