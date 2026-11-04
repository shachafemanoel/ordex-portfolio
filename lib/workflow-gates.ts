import { Order } from '@prisma/client';
import { WorkflowStage } from '@/lib/workflow-status';

export interface ChecklistState {
  [key: string]: boolean;
}

export interface GateRequirement {
  id: string;
  label: string;
  requiredFor: WorkflowStage;
}

export const WORKFLOW_GATES: Record<WorkflowStage, GateRequirement[]> = {
  [WorkflowStage.NEW]: [],
  [WorkflowStage.IN_PREPARATION]: [
    {
      id: 'confirmed_details',
      label: 'Confirm Order Details',
      requiredFor: WorkflowStage.IN_PREPARATION,
    },
    {
      id: 'payment_verified',
      label: 'Verify Payment/deposit',
      requiredFor: WorkflowStage.IN_PREPARATION,
    },
  ],
  [WorkflowStage.READY]: [
    { id: 'stock_allocated', label: 'Stock Allocated', requiredFor: WorkflowStage.READY },
    {
      id: 'installation_scheduled',
      label: 'Installation Scheduled',
      requiredFor: WorkflowStage.READY,
    }, // Conditional?
  ],
  [WorkflowStage.SENT]: [
    { id: 'invoice_generated', label: 'Generate Invoice', requiredFor: WorkflowStage.SENT },
    { id: 'client_signoff', label: 'Client Sign-off', requiredFor: WorkflowStage.SENT },
  ],
};

export function getMissingRequirements(
  order: Order,
  targetStage: WorkflowStage
): GateRequirement[] {
  const requirements = WORKFLOW_GATES[targetStage] || [];
  const checklist = (order.checklistState as unknown as ChecklistState) || {};

  return requirements.filter((req) => !checklist[req.id]);
}

export function canTransitionTo(
  order: Order,
  targetStage: WorkflowStage
): { allowed: boolean; missing: GateRequirement[] } {
  const missing = getMissingRequirements(order, targetStage);
  return {
    allowed: missing.length === 0,
    missing,
  };
}
