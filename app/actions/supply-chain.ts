import { getCurrentUser } from '@/lib/auth/verifySession';
import { SupplyChainService } from '@/lib/services/orders/SupplyChainService';
import { ActionPayload, SupplyChainAction } from '@/lib/types/supply-chain';
import { revalidatePath } from 'next/cache';

const service = new SupplyChainService();

export async function executeSupplyChainAction(
  orderId: string,
  action: SupplyChainAction,
  payload: ActionPayload
) {
  // 1. Authenticate
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error('Unauthorized');
  }

  try {
    // 2. Execute Logic
    await service.executeAction(orderId, action, payload, user.id);

    // 3. Revalidate
    revalidatePath(`/orders/${orderId}`);
    revalidatePath('/dashboard/operations');

    return { success: true };
  } catch (error: any) {
    console.error('Supply Chain Action Failed:', error);
    return { success: false, error: error.message };
  }
}
