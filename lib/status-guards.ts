import { getStatusRequirements } from '@/lib/workflow-requirements';
import type { OrderStatus } from '@prisma/client';

type GuardResult = {
  canTransition: boolean;
  blockers?: Array<{ id: string; message: string }>;
};

type ExecuteGuardsResult = {
  allPassed: boolean;
  blockingFailures: Array<{ id: string; message: string }>;
  warnings: Array<{ id: string; message: string }>;
};

export type ChecklistItem = {
  key: string;
  label: string;
  message: string; // Alias for label for backwards compatibility
  completed: boolean;
  required: boolean;
};

/**
 * Execute dynamic guards based on workflow requirements
 */
export function executeGuards(
  order: any,
  status: OrderStatus,
  options?: { currentStatus?: OrderStatus; additionalData?: any }
): ExecuteGuardsResult {
  const requirements = getStatusRequirements(status);
  const blockingFailures: Array<{ id: string; message: string }> = [];
  const warnings: Array<{ id: string; message: string }> = [];

  const orderWithData = options?.additionalData ? { ...order, ...options.additionalData } : order;

  if (requirements) {
    // Check fields
    for (const field of requirements.requiredFields) {
      const value = field.includes('.')
        ? field.split('.').reduce((obj: any, key: string) => obj?.[key], orderWithData)
        : orderWithData[field];

      if (!value) {
        blockingFailures.push({ id: `missing_field_${field}`, message: `שדה חובה חסר: ${field}` });
      }
    }

    // Check conditions
    for (const condition of requirements.conditions) {
      try {
        if (!condition.check(orderWithData)) {
          blockingFailures.push({ id: condition.name, message: condition.message });
        }
      } catch (e) {
        console.warn(`Guard check failed for ${condition.name}`, e);
        blockingFailures.push({ id: condition.name, message: condition.message });
      }
    }

    // Legacy manual action checks have been removed because they are now
    // handled by the new Task system (OrderTasks) and previously blocked
    // transitions incorrectly by checking target status checklistState.
  }

  return {
    allPassed: blockingFailures.length === 0,
    blockingFailures,
    warnings,
  };
}

export function isTransitionAllowed(
  order: any,
  newStatus: OrderStatus,
  options?: { currentStatus?: OrderStatus; additionalData?: any }
): { allowed: boolean; reason?: string; failures: Array<{ id: string; message: string }> } {
  const result = executeGuards(order, newStatus, options);

  return {
    allowed: result.allPassed,
    reason: result.blockingFailures.length > 0 ? result.blockingFailures[0].message : undefined,
    failures: result.blockingFailures,
  };
}

export function getStatusChecklist(
  order: any,
  status: OrderStatus,
  options?: { currentStatus?: OrderStatus; additionalData?: any }
): ChecklistItem[] {
  const requirements = getStatusRequirements(status);
  if (!requirements) return [];

  const orderWithData = options?.additionalData ? { ...order, ...options.additionalData } : order;
  const items: ChecklistItem[] = [];
  const checklistState = (order.checklistState || order.metadata?.checklist || {}) as Record<
    string,
    boolean
  >;

  // Manual Actions
  requirements.manualActions.forEach((action, index) => {
    const key = `manual_${status}_${index}`;
    items.push({
      key,
      label: action,
      message: action,
      completed: !!checklistState[key],
      required: true,
    });
  });

  // Fields
  requirements.requiredFields.forEach((field) => {
    const value = field.includes('.')
      ? field.split('.').reduce((obj: any, key: string) => obj?.[key], orderWithData)
      : orderWithData[field];

    items.push({
      key: `field_${field}`,
      label: `שדה ${field}`,
      message: `שדה ${field}`,
      completed: !!value,
      required: true,
    });
  });

  // Conditions
  requirements.conditions.forEach((condition) => {
    let passed = false;
    try {
      passed = condition.check(orderWithData);
    } catch {
      passed = false;
    }

    items.push({
      key: condition.name,
      label: condition.message,
      message: condition.message,
      completed: passed,
      required: true,
    });
  });

  return items;
}

// Legacy compatibility
export function executeStatusGuards(order: any, newStatus: OrderStatus): GuardResult {
  const result = executeGuards(order, newStatus);

  return {
    canTransition: result.allPassed,
    blockers: result.blockingFailures,
  };
}

export function getGuardErrorMessage(result: GuardResult | ExecuteGuardsResult): string {
  if ('blockers' in result && result.blockers) {
    if (result.blockers.length === 0) return '';
    if (result.blockers.length === 1) return result.blockers[0].message;
    return result.blockers.map((b) => `• ${b.message}`).join('\n');
  }

  if ('blockingFailures' in result) {
    if (result.blockingFailures.length === 0) return '';
    if (result.blockingFailures.length === 1) return result.blockingFailures[0].message;
    return result.blockingFailures.map((b) => `• ${b.message}`).join('\n');
  }

  return '';
}
