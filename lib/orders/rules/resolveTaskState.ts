import { RULES } from '@/lib/orders/rules/rulesTable';
import { OrderSnapshot } from '@/lib/orders/rules/orderSnapshot';
import { TaskState } from '@/lib/orders/rules/types';
import { TASK_LABEL_HE } from '@/lib/orders/rules/taskLabelMap';

export function resolveTaskState(snapshot: OrderSnapshot): TaskState {
  const sortedRules = [...RULES].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (rule.condition(snapshot)) {
      const result = rule.resolve(snapshot);

      // Determine if blocked
      const blockingItems = result.checklist.filter(
        (item) => item.status === 'TODO' || item.status === 'BLOCKED'
      );
      const isBlocked = blockingItems.length > 0;
      const blockReasons = blockingItems.map((i) => i.labelHe);

      return {
        taskLabel: result.taskLabel,
        taskLabelHe: TASK_LABEL_HE[result.taskLabel] || result.taskLabel,
        checklist: result.checklist,
        isBlocked,
        blockReasons,
        deferBucket: result.deferBucket,
        allowedQuickActions: result.allowedQuickActions || [],
      };
    }
  }

  // Should satisfy R9
  throw new Error('No rule matched order state');
}
