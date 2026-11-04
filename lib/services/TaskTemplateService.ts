/**
 * Task Template Service
 *
 * Defines task templates that are automatically generated based on order status
 * transitions in the supply chain workflow.
 */

import { OrderStatus } from '@prisma/client';

export type SupplyChainStage = 'PAYMENT' | 'INVENTORY' | 'DELIVERY';

export interface TaskTemplate {
  id: string;
  stage: SupplyChainStage;
  name: string;
  description: string;
  triggerStatus: OrderStatus[];
  nextDayTask: boolean;
  icon: string;
}

/**
 * Predefined task templates mapped to supply chain stages
 */
export const TASK_TEMPLATES: TaskTemplate[] = [
  // PAYMENT Stage
  {
    id: 'contact_customer_payment',
    stage: 'PAYMENT',
    name: 'לחזור ללקוח',
    description: 'לא בוצע תשלום - יש לחזור ללקוח לסגירת ההזמנה',
    triggerStatus: ['TO_DO'],
    nextDayTask: false,
    icon: '📞',
  },

  // INVENTORY Stage
  {
    id: 'create_purchase_order',
    stage: 'INVENTORY',
    name: 'לבצע הזמנת רכש',
    description: 'יש לבצע הזמנת רכש לפריטים בהזמנה',
    triggerStatus: ['AWAITING_STOCK'],
    nextDayTask: false,
    icon: '📦',
  },
  {
    id: 'update_item_receipt',
    stage: 'INVENTORY',
    name: 'לעדכן קבלת פריטים',
    description: 'לאחר הזמנת רכש - יש לעדכן קבלת הפריטים',
    triggerStatus: ['PO_CREATED', 'AWAITING_STOCK'],
    nextDayTask: false,
    icon: '✅',
  },
  {
    id: 'item_issue_contact',
    stage: 'INVENTORY',
    name: 'בעיה בפריט - לפנות ללקוח',
    description: 'יש בעיה באחד הפריטים ויש צורך לפנות ללקוח',
    triggerStatus: ['PARTIALLY_SUPPLIED'],
    nextDayTask: false,
    icon: '⚠️',
  },

  // DELIVERY Stage
  {
    id: 'schedule_delivery',
    stage: 'DELIVERY',
    name: 'לתאם מועד אספקה',
    description: 'יש לתאם מועד אספקה עם הלקוח',
    triggerStatus: ['READY_FOR_INSTALL'],
    nextDayTask: false,
    icon: '📅',
  },
  {
    id: 'complete_delivery',
    stage: 'DELIVERY',
    name: 'לעדכן אספקה הושלמה',
    description: 'לאחר האספקה - יש לעדכן שהאספקה הושלמה ולסגור את ההזמנה',
    triggerStatus: ['SCHEDULED'],
    nextDayTask: true,
    icon: '🚚',
  },
];

/**
 * Get task templates for a specific order status
 */
export function getTasksForStatus(status: OrderStatus): TaskTemplate[] {
  return TASK_TEMPLATES.filter((t) => t.triggerStatus.includes(status));
}

/**
 * Get task templates grouped by supply chain stage
 */
export function getTasksByStage(): Record<SupplyChainStage, TaskTemplate[]> {
  return {
    PAYMENT: TASK_TEMPLATES.filter((t) => t.stage === 'PAYMENT'),
    INVENTORY: TASK_TEMPLATES.filter((t) => t.stage === 'INVENTORY'),
    DELIVERY: TASK_TEMPLATES.filter((t) => t.stage === 'DELIVERY'),
  };
}

/**
 * Task counts by template for dashboard display
 */
export interface TaskCount {
  templateId: string;
  templateName: string;
  icon: string;
  count: number;
  stage: SupplyChainStage;
}

/**
 * Calculate task counts based on order status distribution
 */
export function calculateTaskCounts(statusCounts: Record<string, number>): TaskCount[] {
  const counts: TaskCount[] = [];

  for (const template of TASK_TEMPLATES) {
    let count = 0;
    for (const status of template.triggerStatus) {
      count += statusCounts[status] || 0;
    }
    if (count > 0) {
      counts.push({
        templateId: template.id,
        templateName: template.name,
        icon: template.icon,
        count,
        stage: template.stage,
      });
    }
  }

  return counts;
}

/**
 * Stage metadata for display
 */
export const STAGE_META: Record<SupplyChainStage, { label: string; icon: string; color: string }> =
  {
    PAYMENT: { label: 'תשלום', icon: '💳', color: 'orange' },
    INVENTORY: { label: 'הזמנות ומלאי', icon: '📦', color: 'amber' },
    DELIVERY: { label: 'אספקה', icon: '🚚', color: 'emerald' },
  };
