'use server';

import { purchasingService } from '@/lib/services/purchasing/PurchasingService';
import { revalidatePath } from 'next/cache';

export async function createPurchaseOrderAction(
  supplierId: string,
  items: { product: string; quantity: number; linkedIds: string[] }[]
) {
  // Map input to service expected format
  // items: { productId, quantity, linkedOrderItemIds }
  const serviceItems = items.map((i) => ({
    productId: i.product,
    quantity: i.quantity,
    linkedOrderItemIds: i.linkedIds,
  }));

  await purchasingService.createPurchaseOrder(supplierId, serviceItems);
  revalidatePath('/dashboard');
  revalidatePath('/orders');
  return { success: true };
}

export async function receivePurchaseOrderAction(
  purchaseOrderId: string,
  items: { productId: string; quantity: number }[]
) {
  await purchasingService.receivePurchaseOrder(purchaseOrderId, items);
  revalidatePath('/dashboard');
  revalidatePath('/orders');
  return { success: true };
}
