import type { Order } from '@/lib/types';

export type AllocationStatus = 'PENDING' | 'ALLOCATED' | 'OUT_OF_STOCK' | 'ON_ORDER';
export type AllocationSource = 'STOCK' | 'SUPPLIER';
export type IntakeDecision = 'STOCK' | 'PO';

export type BatchAllocationUpdate = {
  itemId: string;
  source: AllocationSource;
  supplierId?: string | null;
};

export type OrderOpsData = Order & { notesToCrew?: string | null };
export type RawOrderItem = NonNullable<OrderOpsData['items']>[number];

export type OpsItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  supplierId: string | null;
  supplierName: string | null;
  received: boolean;
  receivedQuantity: number;
  allocationStatus: AllocationStatus;
};

export type SupplierOption = {
  id: string;
  name: string;
};

export type WorkflowTab = 'intake' | 'purchase' | 'receive' | 'schedule' | 'delivery' | 'actions';
export type WorkflowPrimaryTab = 'intake' | 'schedule' | 'actions';
export type WorkflowActionPanel = 'address' | null;

export type OrderPhase = 'intake' | 'scheduling' | 'delivery' | 'completed' | 'cancelled';

export type WorkflowFocus = {
  tab: WorkflowPrimaryTab;
  title: string;
  description: string;
  primaryLabel: string;
  source: 'server' | 'local';
  actionPanel: WorkflowActionPanel;
  actionId?: string | null;
};
