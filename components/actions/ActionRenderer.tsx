import { ActionDefinition } from '@/lib/actions/registry';
import React from 'react';
import { GoodsReceiptModal } from '@/components/actions/orders/GoodsReceiptModal';
import { PaymentModal } from '@/components/actions/orders/PaymentModal';
import { AddressModal } from '@/components/actions/orders/AddressModal';
import { ScheduleModal } from '@/components/actions/orders/ScheduleModal';
import { OrderItemsConfirmationModal } from '@/components/orders/modals/OrderItemsConfirmationModal';

interface ActionRendererProps<TEntity> {
  action: ActionDefinition<TEntity>;
  isOpen: boolean;
  onClose: () => void;
  entity: TEntity;
  onConfirm: (payload: any) => Promise<void>;
}

const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  'GoodsReceipt': GoodsReceiptModal,
  'PaymentEditor': PaymentModal,
  'AddressEditor': AddressModal,
  'ScheduleInstallation': ScheduleModal,
  'OrderItemsConfirmation': OrderItemsConfirmationModal,
};

export function ActionRenderer<TEntity>({ action, isOpen, onClose, entity, onConfirm }: ActionRendererProps<TEntity>) {
  if (!isOpen) return null;

  const Component = action.ui.componentKey ? COMPONENT_MAP[action.ui.componentKey] : null;

  if (!Component) {
    console.warn(`No component found for key: ${action.ui.componentKey}`);
    return null;
  }

  return (
    <Component
      isOpen={isOpen}
      onClose={onClose}
      entity={entity}
      onConfirm={onConfirm}
      title={action.ui.title}
      description={action.ui.description}
    />
  );
}
