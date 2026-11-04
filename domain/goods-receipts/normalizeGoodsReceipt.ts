import { GoodsReceiptDTO } from '@/domain/goods-receipts/types';
import { normalizeReceivingItems } from '@/domain/goods-receipts/normalizeReceivingItem';

export function normalizeGoodsReceipt(receipt: any): GoodsReceiptDTO | null {
  if (!receipt || !receipt.id) return null;

  return {
    id: receipt.id,
    supplierId: receipt.supplierId || null,
    purchaseOrderId: receipt.purchaseOrderId || null,
    reference: receipt.reference || null,
    notes: receipt.notes || null,
    receivedAt: receipt.receivedAt ? new Date(receipt.receivedAt).toISOString() : new Date().toISOString(),
    createdBy: receipt.createdBy || null,
    createdAt: receipt.createdAt ? new Date(receipt.createdAt).toISOString() : new Date().toISOString(),
    items: receipt.items ? normalizeReceivingItems(receipt.items) : undefined,
    supplierName: receipt.supplier?.name,
    purchaseOrderReference: receipt.purchaseOrder?.reference,
    createdByName: receipt.createdByUser?.name,
  };
}

export function normalizeGoodsReceipts(receipts: any[]): GoodsReceiptDTO[] {
  if (!Array.isArray(receipts)) return [];
  return receipts.map(normalizeGoodsReceipt).filter((r): r is GoodsReceiptDTO => r !== null);
}

// Re-export type for backward compatibility if needed, but prefer importing from types.ts
export type { GoodsReceiptDTO } from '@/domain/goods-receipts/types';
