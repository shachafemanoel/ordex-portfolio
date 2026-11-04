import { OrderStatus, type DeferBucket } from '@prisma/client';
import { resolveTaskState } from '@/lib/orders/rules/resolveTaskState';
import { TASK_LABEL_HE, TaskLabel } from '@/lib/orders/rules/taskLabelMap';

import type { OrderSnapshot } from '@/lib/orders/rules/orderSnapshot';
import { TaskState, ChecklistItem } from '@/lib/orders/rules/types'; // Corrected import path
// Redefine types if needed to avoid circular dependency or import issues
export type OpsLaneType = 'NEEDS_ACTION' | 'WAITING' | 'SCHEDULED';

export interface OrderRequirement {
  id: string;
  type: 'ORDER_GATE' | 'ITEM_CHECK' | 'SUPPLIER_ACTION';
  label: string;
  status: 'complete' | 'incomplete' | 'overdue' | 'waiting';
  description?: string;
  dueAt?: Date;
  itemId?: string;
}

const TASK_FLOW_ORDER: TaskLabel[] = [
  TaskLabel.CLOSE_ORDER,
  TaskLabel.CALLBACK_CUSTOMER,
  TaskLabel.VERIFY_PAYMENT,
  TaskLabel.VERIFY_STOCK,
  TaskLabel.CREATE_PURCHASE_ORDER,
  TaskLabel.ASSIGN_SUPPLIERS,
  TaskLabel.WAIT_SUPPLIER_DELIVERY,
  TaskLabel.RECEIVE_GOODS,
  TaskLabel.RECEIVE_GOODS_PARTIAL,
  TaskLabel.SCHEDULE_INSTALLATION,
  TaskLabel.WAIT_INSTALLATION_DAY,
  TaskLabel.VERIFY_ORDER,
];

const DISPLAY_LIFECYCLE: TaskLabel[] = [
  TaskLabel.CALLBACK_CUSTOMER,
  TaskLabel.VERIFY_PAYMENT,
  TaskLabel.VERIFY_STOCK,
  TaskLabel.CREATE_PURCHASE_ORDER,
  TaskLabel.ASSIGN_SUPPLIERS,
  TaskLabel.WAIT_SUPPLIER_DELIVERY,
  TaskLabel.RECEIVE_GOODS,
  TaskLabel.SCHEDULE_INSTALLATION,
  TaskLabel.WAIT_INSTALLATION_DAY,
];

export interface DrillStep {
  id: string;
  labelHe: string;
  status: 'DONE' | 'TODO' | 'BLOCKED';
  required: boolean;
  actionHint?: string;
  missingFields?: string[];
  isDbField: boolean;
}

export interface DrillTask {
  taskLabel: TaskLabel;
  taskLabelHe: string;
  steps: DrillStep[];
  quickActions: Array<{
    id: string;
    labelHe: string;
    kind: 'button' | 'modal' | 'navigation';
  }>;
}

export interface DrillState {
  lifecycle: { label: string; labelHe: string; status: 'DONE' | 'CURRENT' | 'TODO' }[];
  lane: OpsLaneType;
  laneLabel: string;
  color: 'green' | 'blue' | 'amber' | 'red';
  currentTask: DrillTask;
  nextTask: { taskLabel: TaskLabel; taskLabelHe: string } | null;
  progressPct: number;
  progressText: string;
  isSnoozed: boolean;
  snoozeUntil: Date | null;
  snoozeReason: string | null;
  checklistOverrides: Record<string, boolean>;
  requirements: OrderRequirement[];
  deferBucket: DeferBucket | null;
  isBlocked: boolean;
  blockReasons: string[];
}

export interface DrillInput {
  snapshot: OrderSnapshot;
  opsChecklistState?: Record<string, Record<string, boolean>> | null;
  opsSnoozeUntil?: Date | null;
  opsSnoozeReason?: string | null;
}

export function computeDrillState(input: DrillInput): DrillState {
  const { snapshot, opsChecklistState, opsSnoozeUntil, opsSnoozeReason } = input;
  const now = new Date();

  const taskState = resolveTaskState(snapshot);
  const isSnoozed = !!opsSnoozeUntil && opsSnoozeUntil > now;
  const taskOverrides = opsChecklistState?.[taskState.taskLabel] ?? {};

  const steps: DrillStep[] = taskState.checklist.map((item) => {
    const manualDone = !!taskOverrides[item.id];
    const engineStatus = item.status;
    let finalStatus = engineStatus;
    if (engineStatus === 'TODO' && manualDone) {
       finalStatus = 'DONE';
    }
    return {
      id: item.id,
      labelHe: item.labelHe,
      status: finalStatus,
      required: true,
      actionHint: item.actionHint,
      missingFields: item.missingFields,
      isDbField: false,
    };
  });

  const currentIdx = DISPLAY_LIFECYCLE.indexOf(taskState.taskLabel);
  const lifecycle = DISPLAY_LIFECYCLE.map((taskLabel) => {
    const taskIdx = DISPLAY_LIFECYCLE.indexOf(taskLabel);
    let status: 'DONE' | 'CURRENT' | 'TODO' = 'TODO';
    if (currentIdx === -1) {
       status = 'DONE';
    } else {
       if (taskIdx < currentIdx) status = 'DONE';
       else if (taskIdx === currentIdx) status = 'CURRENT';
    }

    return {
      label: taskLabel,
      labelHe: TASK_LABEL_HE[taskLabel] ?? taskLabel,
      status,
    };
  });

  const totalMandatory = steps.filter((s) => s.required).length;
  const completedMandatory = steps.filter((s) => s.required && s.status === 'DONE').length;
  const progressPct = totalMandatory > 0 ? Math.round((completedMandatory / totalMandatory) * 100) : 100;

  let lane: OpsLaneType;
  if (isSnoozed) {
    lane = 'WAITING';
  } else if (isWaitingTask(taskState.taskLabel)) {
    lane = 'WAITING';
    if (taskState.taskLabel === TaskLabel.WAIT_INSTALLATION_DAY) {
        lane = 'SCHEDULED';
    }
  } else {
    lane = 'NEEDS_ACTION';
  }

  const nextTask = getNextTask(taskState.taskLabel);
  const requirements = stepsToRequirements(snapshot.id, steps, taskState);

  return {
    lifecycle,
    lane,
    laneLabel: getLaneLabel(lane),
    color: getLaneColor(lane),
    currentTask: {
      taskLabel: taskState.taskLabel,
      taskLabelHe: taskState.taskLabelHe,
      steps,
      quickActions: taskState.allowedQuickActions,
    },
    nextTask,
    progressPct,
    progressText: `${completedMandatory}/${totalMandatory}`,
    isSnoozed,
    snoozeUntil: opsSnoozeUntil ?? null,
    snoozeReason: opsSnoozeReason ?? null,
    checklistOverrides: taskOverrides,
    requirements,
    deferBucket: taskState.deferBucket,
    isBlocked: taskState.isBlocked,
    blockReasons: taskState.blockReasons,
  };
}

function isWaitingTask(label: TaskLabel): boolean {
  return (
    label === TaskLabel.WAIT_SUPPLIER_DELIVERY ||
    label === TaskLabel.RECEIVE_GOODS ||
    label === TaskLabel.WAIT_INSTALLATION_DAY
  );
}

function getNextTask(currentLabel: TaskLabel): { taskLabel: TaskLabel; taskLabelHe: string } | null {
  const idx = TASK_FLOW_ORDER.indexOf(currentLabel);
  if (idx === -1 || idx >= TASK_FLOW_ORDER.length - 1) return null;
  for (let i = idx + 1; i < TASK_FLOW_ORDER.length; i++) {
    const next = TASK_FLOW_ORDER[i];
    if (next !== TaskLabel.CLOSE_ORDER && next !== TaskLabel.VERIFY_ORDER) {
      return { taskLabel: next, taskLabelHe: TASK_LABEL_HE[next] };
    }
  }
  return null;
}

function stepsToRequirements(
  orderId: string,
  steps: DrillStep[],
  taskState: TaskState
): OrderRequirement[] {
  return steps.map((step) => ({
    id: `${orderId}-${step.id}`,
    type: 'ORDER_GATE' as const,
    label: step.labelHe,
    status: step.status === 'DONE' ? ('complete' as const) : ('incomplete' as const),
    description: step.missingFields?.length
      ? `חסר: ${step.missingFields.join(', ')}`
      : undefined,
  }));
}

export function getLaneLabel(lane: OpsLaneType): string {
  switch (lane) {
    case 'WAITING': return 'ממתין';
    case 'NEEDS_ACTION': return 'דורש טיפול';
    case 'SCHEDULED': return 'מתוזמן';
    default: return 'לא ידוע';
  }
}

export function getLaneColor(lane: OpsLaneType): 'green' | 'blue' | 'amber' | 'red' {
  switch (lane) {
    case 'SCHEDULED': return 'green';
    case 'WAITING': return 'blue';
    case 'NEEDS_ACTION': return 'amber';
    default: return 'red';
  }
}
