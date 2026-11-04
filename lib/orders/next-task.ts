import { OrderStatus } from '@prisma/client';

export interface NextTask {
  key: string;
  labelHe: string;
  labelEn: string;
  ctaLabelHe: string;
  ctaLabelEn: string;
}

/**
 * Compute the next operational task for an order based on its status.
 * Returns the primary action the operator needs to take.
 */
export function computeNextTask(status: OrderStatus): NextTask {
  switch (status) {
    // Today - needs action
    case 'TO_DO':
    case 'RECEIVED':
    case 'DRAFT':
    case 'PENDING_APPROVAL':
    case 'CONFIRMED':
      return {
        key: 'review_order',
        labelHe: 'בדוק הזמנה',
        labelEn: 'Review order',
        ctaLabelHe: 'טפל בהזמנה',
        ctaLabelEn: 'Process order',
      };

    case 'CALL_BACK':
      return {
        key: 'contact_customer',
        labelHe: 'חזור ללקוח',
        labelEn: 'Contact customer',
        ctaLabelHe: 'התקשר ללקוח',
        ctaLabelEn: 'Call customer',
      };

    // In Progress - procurement
    case 'PO_CREATED':
    case 'PROCESSING':
      return {
        key: 'send_to_supplier',
        labelHe: 'שלח לספק והגדר ETA',
        labelEn: 'Send to supplier & set ETA',
        ctaLabelHe: 'סמן נשלח לספק',
        ctaLabelEn: 'Mark sent to supplier',
      };

    case 'AWAITING_STOCK':
      return {
        key: 'receive_goods',
        labelHe: 'קבל סחורה',
        labelEn: 'Receive goods',
        ctaLabelHe: 'קבל סחורה',
        ctaLabelEn: 'Receive goods',
      };

    case 'PARTIALLY_SUPPLIED':
      return {
        key: 'receive_remaining',
        labelHe: 'קבל פריטים שנותרו',
        labelEn: 'Receive remaining items',
        ctaLabelHe: 'קבל סחורה',
        ctaLabelEn: 'Receive goods',
      };

    // Scheduling
    case 'INSTALL_SCHEDULING':
    case 'READY_FOR_INSTALL':
    case 'READY':
      return {
        key: 'schedule_installation',
        labelHe: 'תאם מועד התקנה/הספקה',
        labelEn: 'Schedule installation/delivery',
        ctaLabelHe: 'קבע מועד',
        ctaLabelEn: 'Set date',
      };

    // Scheduled - waiting for execution
    case 'SCHEDULED':
    case 'AWAITING_INSTALL':
    case 'IN_TRANSIT':
    case 'INSTALLATION':
      return {
        key: 'execute_delivery',
        labelHe: 'בצע התקנה/הספקה',
        labelEn: 'Execute installation/delivery',
        ctaLabelHe: 'סמן סופק',
        ctaLabelEn: 'Mark delivered',
      };

    // Done
    case 'SUPPLIED':
    case 'INSTALLED':
    case 'INVOICED':
    case 'COMPLETED':
    case 'CLOSED':
      return {
        key: 'done',
        labelHe: 'הזמנה הושלמה',
        labelEn: 'Order completed',
        ctaLabelHe: 'צפה',
        ctaLabelEn: 'View',
      };

    case 'CANCELLED':
    case 'REFUNDED':
      return {
        key: 'cancelled',
        labelHe: 'הזמנה בוטלה',
        labelEn: 'Order cancelled',
        ctaLabelHe: 'צפה',
        ctaLabelEn: 'View',
      };

    case 'ON_HOLD':
      return {
        key: 'resume_order',
        labelHe: 'שחרר מהשהייה',
        labelEn: 'Resume order',
        ctaLabelHe: 'שחרר',
        ctaLabelEn: 'Resume',
      };

    default:
      return {
        key: 'review_order',
        labelHe: 'בדוק הזמנה',
        labelEn: 'Review order',
        ctaLabelHe: 'טפל',
        ctaLabelEn: 'Process',
      };
  }
}

/**
 * Compute "waiting since" duration from last action timestamp.
 * Returns a human-readable Hebrew string.
 */
export function computeWaitingSince(lastActionAt: Date | string | null, createdAt: Date | string): string {
  const ref = lastActionAt ? new Date(lastActionAt) : new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - ref.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) return `${diffMinutes} דק׳`;
  if (diffHours < 24) return `${diffHours} שע׳`;
  if (diffDays === 1) return 'יום';
  return `${diffDays} ימים`;
}
