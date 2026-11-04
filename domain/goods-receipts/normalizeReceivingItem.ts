import { ReceivingItemDTO } from '@/domain/goods-receipts/types';

export function normalizeReceivingItem(item: any): ReceivingItemDTO | null {
  if (!item || !item.id) return null;

  return {
    id: item.id,
    goodsReceiptId: item.goodsReceiptId,
    orderItemId: item.orderItemId || null,
    productId: item.sku_id || item.productId || null,
    quantityReceived: item.quantityReceived,
    notes: item.notes || null,
    productName: item.sku?.name || item.product?.name || undefined,
    sku: item.sku?.code || item.product?.sku || undefined,
  };
}

export function normalizeReceivingItems(items: any[]): ReceivingItemDTO[] {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeReceivingItem).filter((i): i is ReceivingItemDTO => i !== null);
}
