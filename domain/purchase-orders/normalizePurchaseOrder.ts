/**
 * Purchase Order normalization utilities
 */
import type { PurchaseOrderStatus as PrismaPurchaseOrderStatus } from '@prisma/client';
import { fromPrismaPurchaseOrderStatus } from '@/lib/purchaseOrderStatus';

export interface PurchaseOrderItemDTO {
  id: string;
  productId?: string | null;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface PurchaseOrderDTO {
  id: string;
  reference: string;
  supplierId: string;
  status: string;
  linkedOrderIds: string[];
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseOrderItemDTO[];
}

export function normalizePurchaseOrderItem(item: any): PurchaseOrderItemDTO | null {
  if (!item || !item.id) return null;

  return {
    id: item.id,
    productId: item.productId || null,
    sku: item.sku || '',
    name: item.name || item.productName || '',
    quantity: item.quantity || item.qty || 0,
    unitPriceCents: item.unitPriceCents || 0,
    totalCents: item.totalCents || 0,
  };
}

export function normalizePurchaseOrderItems(items: any[]): PurchaseOrderItemDTO[] {
  if (!Array.isArray(items)) return [];
  return items.map(normalizePurchaseOrderItem).filter((i): i is PurchaseOrderItemDTO => i !== null);
}

export function normalizePurchaseOrder(po: any): PurchaseOrderDTO | null {
  if (!po || !po.id) return null;

  const items = po.items ? normalizePurchaseOrderItems(po.items) : undefined;
  const normalizedStatus = fromPrismaPurchaseOrderStatus(po.status as PrismaPurchaseOrderStatus | undefined);

  return {
    id: po.id,
    reference: po.reference || po.poNumber || '',
    supplierId: po.supplierId || '',
    status: normalizedStatus,
    linkedOrderIds: Array.isArray(po.linkedOrderIds) ? po.linkedOrderIds : [],
    totalCents: po.totalCents || 0,
    createdAt: po.createdAt ? new Date(po.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: po.updatedAt ? new Date(po.updatedAt).toISOString() : new Date().toISOString(),
    items,
  };
}

export function normalizePurchaseOrders(pos: any[]): PurchaseOrderDTO[] {
  if (!Array.isArray(pos)) return [];
  return pos.map(normalizePurchaseOrder).filter((p): p is PurchaseOrderDTO => p !== null);
}
