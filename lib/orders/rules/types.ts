import { DeferBucket, TaskLabel } from '@prisma/client';
import { OrderSnapshot } from '@/lib/orders/rules/orderSnapshot';

export interface ChecklistItem {
  id: string;
  labelHe: string;
  status: 'DONE' | 'TODO' | 'BLOCKED';
  missingFields?: string[];
  actionHint?: string;
}

export interface TaskState {
  taskLabel: TaskLabel;
  taskLabelHe: string;
  checklist: ChecklistItem[];
  isBlocked: boolean;
  blockReasons: string[];
  deferBucket: DeferBucket;
  allowedQuickActions: Array<{
    id: string;
    labelHe: string;
    kind: 'button' | 'modal' | 'navigation';
    payloadSchema?: any;
  }>;
}

export interface RuleResult {
  taskLabel: TaskLabel;
  checklist: ChecklistItem[];
  deferBucket: DeferBucket;
  allowedQuickActions?: TaskState['allowedQuickActions'];
}

export interface Rule {
  id: string;
  priority: number;
  condition: (snapshot: OrderSnapshot) => boolean;
  resolve: (snapshot: OrderSnapshot) => RuleResult;
}
