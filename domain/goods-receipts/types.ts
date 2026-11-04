/**
 * Goods Receipts Domain Type Definitions
 */

export interface ReceivingItemDTO {
  id: string;
  goodsReceiptId: string;
  orderItemId?: string | null;
  productId?: string | null;
  quantityReceived: number;
  notes?: string | null;
  // Expanded fields if needed
  productName?: string;
  sku?: string;
}

export interface GoodsReceiptDTO {
  id: string;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  reference?: string | null;
  notes?: string | null;
  receivedAt: string;
  createdBy?: string | null;
  createdAt: string;
  // Relations
  items?: ReceivingItemDTO[];
  supplierName?: string;
  purchaseOrderReference?: string;
  createdByName?: string;
}
