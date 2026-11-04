export class OrderAutomationService {
  static async onOrderCreated(orderId: string, status: string, userId?: string) {
    return { orderId, status, userId, handled: false };
  }

  static async onStatusChange(
    orderId: string,
    fromStatus: string,
    toStatus: string,
    userId?: string
  ) {
    return { orderId, fromStatus, toStatus, userId, handled: false };
  }

  static async onGoodsReceived(orderId: string, userId?: string) {
    return { orderId, userId, handled: false };
  }
}
