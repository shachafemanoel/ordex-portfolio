export async function createPurchaseApprovalAction(orderId: string) {
  return {
    actionId: `purchase-approval:${orderId}`,
    messageText: `Purchase approval queued for ${orderId}`,
  };
}
