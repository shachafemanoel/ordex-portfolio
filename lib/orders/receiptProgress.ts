import type { OrderItem } from '@prisma/client';

export function computeReceiptProgress(items: Pick<OrderItem, 'qty' | 'receivedQuantity'>[]) {
  const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const receivedQty = items.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0);
  const progress = totalQty > 0 ? Math.round((receivedQty / totalQty) * 100) : 0;
  return { totalQty, receivedQty, progress };
}
