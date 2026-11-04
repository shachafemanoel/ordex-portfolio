export async function enqueueOpsReminderJobsForOrder(orderId: string, reason?: string | null) {
  return {
    orderId,
    reason: reason ?? null,
    enqueued: false,
  };
}
