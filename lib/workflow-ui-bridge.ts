import type { OrderStatus } from '@prisma/client';
import { WORKFLOW_REQUIREMENTS } from '@/lib/workflow-requirements';

/**
 * Action types that can be triggered from the UI
 */
export enum ActionType {
  OPEN_MODAL = 'OPEN_MODAL',
  API_CALL = 'API_CALL',
  NAVIGATE = 'NAVIGATE',
}

/**
 * UI Action definition
 */
export interface Action {
  id: string;
  label: string;
  type: ActionType;
  isPrimary?: boolean;
  payload: any;
}

/**
 * Workflow hints for the current order state
 */
export interface WorkflowHints {
  currentStage: string;
  description: string;
  blockers?: string[];
}

/**
 * Generate next actions for an order based on its current status
 * This bridges workflow-requirements.ts with the UI
 */
export function generateNextActions(order: any): Action[] {
  const status = order.status as OrderStatus;
  const requirements = WORKFLOW_REQUIREMENTS[status];
  const actions: Action[] = [];

  // Check what's missing and suggest actions
  switch (status) {
    case 'TO_DO':
    case 'CALL_BACK':
      // Primary: Contact customer
      actions.push({
        id: 'contact_customer',
        label: 'צור קשר עם הלקוח',
        type: ActionType.OPEN_MODAL,
        isPrimary: true,
        payload: { modal: 'CONTACT' },
      });
      break;

    case 'CONFIRMED':
      // Check if payment is needed
      const totalCents = Math.round((order.total || 0) * 100);
      const paidCents = Math.round((order.paidAmount || 0) * 100);
      const needsPayment = paidCents < totalCents;

      // Check if address is complete
      const hasAddress = order.shippingAddress?.city && order.shippingAddress?.street;

      if (needsPayment) {
        actions.push({
          id: 'add_payment',
          label: 'הוסף תשלום',
          type: ActionType.OPEN_MODAL,
          isPrimary: true,
          payload: { modal: 'PAYMENT' },
        });
      }

      if (!hasAddress) {
        actions.push({
          id: 'update_address',
          label: 'עדכן כתובת',
          type: ActionType.OPEN_MODAL,
          isPrimary: !needsPayment,
          payload: { modal: 'ADDRESS' },
        });
      }

      // Check items availability
      actions.push({
        id: 'check_items',
        label: 'בדוק זמינות פריטים',
        type: ActionType.OPEN_MODAL,
        isPrimary: !needsPayment && hasAddress,
        payload: { modal: 'ITEMS_AVAILABILITY' },
      });
      break;

    case 'PO_CREATED':
    case 'AWAITING_STOCK':
    case 'PARTIALLY_SUPPLIED':
      // Primary: Mark items as received
      actions.push({
        id: 'receive_items',
        label: 'עדכן קבלת פריטים',
        type: ActionType.OPEN_MODAL,
        isPrimary: true,
        payload: { modal: 'ITEMS_AVAILABILITY' },
      });
      break;

    case 'READY_FOR_INSTALL':
      // Primary: Schedule installation
      actions.push({
        id: 'schedule_install',
        label: 'תאם התקנה',
        type: ActionType.OPEN_MODAL,
        isPrimary: true,
        payload: { modal: 'SCHEDULE' },
      });
      break;

    case 'SCHEDULED':
    case 'AWAITING_INSTALL':
      // Send reminder
      actions.push({
        id: 'send_reminder',
        label: 'שלח תזכורת',
        type: ActionType.API_CALL,
        isPrimary: false,
        payload: {
          endpoint: `/api/orders/${order.id}/reminder`,
          method: 'POST',
          body: { channel: 'whatsapp' },
        },
      });

      // Advance to completed
      actions.push({
        id: 'mark_completed',
        label: 'סמן כהושלם',
        type: ActionType.API_CALL,
        isPrimary: true,
        payload: {
          endpoint: `/api/orders/${order.id}/transition`,
          method: 'POST',
          body: { toStatus: 'COMPLETED' },
        },
      });
      break;

    case 'COMPLETED':
      // Generate invoice
      actions.push({
        id: 'generate_invoice',
        label: 'צור חשבונית',
        type: ActionType.API_CALL,
        isPrimary: true,
        payload: {
          endpoint: `/api/orders/${order.id}/transition`,
          method: 'POST',
          body: { toStatus: 'INVOICED' },
        },
      });
      break;
  }

  return actions;
}

/**
 * Generate workflow hints for the current order state
 */
export function generateWorkflowHints(order: any): WorkflowHints {
  const status = order.status as OrderStatus;
  const requirements = WORKFLOW_REQUIREMENTS[status];

  // Check for blockers
  const blockers: string[] = [];

  requirements.conditions.forEach((condition) => {
    if (!condition.check(order)) {
      blockers.push(condition.message);
    }
  });

  return {
    currentStage: requirements.description,
    description: getStatusDescription(status, order),
    blockers: blockers.length > 0 ? blockers : undefined,
  };
}

/**
 * Get contextual description for current status
 */
function getStatusDescription(status: OrderStatus, order: any): string {
  switch (status) {
    case 'TO_DO':
      return 'יש לטפל בהזמנה זו ולהתקדם לשלב הבא';
    case 'CALL_BACK':
      return 'יש לחזור ללקוח ולאשר את פרטי ההזמנה';
    case 'CONFIRMED':
      return 'ההזמנה אושרה. יש לבדוק תשלום, כתובת וזמינות פריטים';
    case 'PO_CREATED':
      return 'הזמנת רכש נוצרה. ממתין לקבלת סחורה מהספק';
    case 'AWAITING_STOCK':
      return 'ממתין לקבלת פריטים מהספק';
    case 'PARTIALLY_SUPPLIED':
      return 'חלק מהפריטים התקבלו. יש לעדכן את הסטטוס';
    case 'READY_FOR_INSTALL':
      return 'כל הפריטים זמינים. יש לתאם מועד התקנה עם הלקוח';
    case 'SCHEDULED':
      return `תואם להתקנה ב-${order.scheduledAt ? new Date(order.scheduledAt).toLocaleDateString('he-IL') : 'תאריך לא ידוע'}`;
    case 'AWAITING_INSTALL':
      return 'ממתין להתקנה. ניתן לשלוח תזכורת ללקוח';
    case 'COMPLETED':
      return 'ההתקנה הושלמה. יש לצור חשבונית';
    case 'INVOICED':
      return 'חשבונית נוצרה. ניתן לסגור את ההזמנה';
    default:
      return 'סטטוס לא ידוע';
  }
}
