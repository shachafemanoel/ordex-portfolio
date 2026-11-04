'use client';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { OrderModalStepHeader } from '@/components/orders/shared/OrderModalStepHeader';
import { Order } from '@/lib/types';
import { useMemo } from 'react';
import { OrderItemsTable } from '@/components/orders/details/OrderItemsTable';
import { normalizeOrderStatus } from '@/lib/orderStatus';

interface OrderItemsConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Order;
  onConfirm: (payload: any) => Promise<void>;
  title?: string;
  description?: string;
}

export function OrderItemsConfirmationModal({
  isOpen,
  onClose,
  entity: order,
  onConfirm,
  title,
  description,
}: OrderItemsConfirmationModalProps) {
  const orderItems = useMemo(() => {
    return (order.items || []).map((item: any, idx: number) => {
      const quantity = item.quantity ?? item.qty ?? 0;

      let unitPrice = 0;
      if (item.unitPrice !== undefined) unitPrice = Number(item.unitPrice);
      else if (item.pricePerUnit !== undefined) unitPrice = Number(item.pricePerUnit);
      else if (item.priceCents !== undefined) unitPrice = item.priceCents / 100;

      let total = 0;
      if (item.total !== undefined) total = Number(item.total);
      else if (item.totalCents !== undefined) total = item.totalCents / 100;
      else total = unitPrice * quantity;

      return {
        id: item.id || `idx-${idx}`,
        sku: item.sku || '',
        name: item.name || item.sku || 'פריט ללא שם',
        quantity,
        receivedQuantity: item.receivedQuantity ?? (item.received ? quantity : 0),
        unitPrice,
        totalPrice: total,
      };
    });
  }, [order.items]);

  const handleConfirm = async () => {
    await onConfirm({ confirmed: true });
    onClose();
  };

  // Derive the current canonical status for step context
  const currentStatus = order.status
    ? normalizeOrderStatus(String(order.status))
    : 'RECEIVED';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'אישור פריטים'} maxWidth="lg">
      <div className="space-y-4" dir="rtl">
        {/* Step context: confirming items is part of RECEIVED → PROCESSING */}
        <OrderModalStepHeader
          currentStatus={currentStatus}
          targetStatus="PROCESSING"
          description="אישור הפריטים יאפשר להמשיך לשלב הכנת ההזמנה"
        />

        <p className="text-gray-600 text-sm">
          {description || 'אנא וודא שרשימת הפריטים תקינה לפני העברה לביצוע.'}
        </p>

        <OrderItemsTable
          items={orderItems}
          currency={order.currency || 'ILS'}
        />

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button onClick={handleConfirm}>אשר פריטים והעבר לביצוע</Button>
        </div>
      </div>
    </Modal>
  );
}
