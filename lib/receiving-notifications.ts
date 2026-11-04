/**
 * Receiving Notifications Service
 * Handles notifications and alerts for receiving workflow events
 */

import type { OrderItem, OrderStatus } from '@prisma/client';

// Local interface to replace deleted ReceivingLog model
export interface ReceivingLog {
  id: string;
  orderItemId: string | null;
  quantityReceived: number;
  receivedAt: Date;
  receivedBy: string | null;
}

export interface NotificationEvent {
  type:
    | 'ITEM_RECEIVED'
    | 'ORDER_FULLY_RECEIVED'
    | 'ORDER_STATUS_CHANGED'
    | 'RECEIVING_OVERDUE'
    | 'LOW_STOCK_ALERT';
  orderId: string;
  orderNumber: number;
  customerName: string;
  data: any;
  timestamp: Date;
}

export interface ReceivingNotificationContext {
  orderItem: OrderItem;
  receivingLog: ReceivingLog;
  previousStatus?: OrderStatus;
  newStatus?: OrderStatus;
  orderData: {
    id: string;
    number: number;
    customerName: string;
    status: OrderStatus;
  };
  skuData?: {
    code: string;
    name: string;
    supplierName?: string;
  };
}

export class ReceivingNotificationService {
  /**
   * Send notifications for receiving events
   */
  static async notifyReceivingEvent(context: ReceivingNotificationContext): Promise<void> {
    const events: NotificationEvent[] = [];

    // Item received notification
    events.push({
      type: 'ITEM_RECEIVED',
      orderId: context.orderData.id,
      orderNumber: context.orderData.number,
      customerName: context.orderData.customerName,
      data: {
        skuCode: context.skuData?.code,
        skuName: context.skuData?.name,
        supplierName: context.skuData?.supplierName,
        quantityReceived: context.receivingLog.quantityReceived,
        totalReceived: context.orderItem.receivedQuantity,
        totalOrdered: context.orderItem.qty,
        isFullyReceived: context.orderItem.received,
      },
      timestamp: context.receivingLog.receivedAt,
    });

    // Order fully received notification
    if (context.orderItem.received) {
      // Check if all items in the order are received
      // This would require a more complex query, but for now we'll assume
      // the business logic will handle order status changes appropriately
      events.push({
        type: 'ORDER_FULLY_RECEIVED',
        orderId: context.orderData.id,
        orderNumber: context.orderData.number,
        customerName: context.orderData.customerName,
        data: {
          skuCode: context.skuData?.code,
          completedAt: context.receivingLog.receivedAt,
        },
        timestamp: context.receivingLog.receivedAt,
      });
    }

    // Order status change notification
    if (
      context.previousStatus &&
      context.newStatus &&
      context.previousStatus !== context.newStatus
    ) {
      events.push({
        type: 'ORDER_STATUS_CHANGED',
        orderId: context.orderData.id,
        orderNumber: context.orderData.number,
        customerName: context.orderData.customerName,
        data: {
          previousStatus: context.previousStatus,
          newStatus: context.newStatus,
          trigger: 'RECEIVING_UPDATE',
          triggeredBy: context.receivingLog.receivedBy,
        },
        timestamp: context.receivingLog.receivedAt,
      });
    }

    // Process all events
    await Promise.all(events.map((event) => this._processNotificationEvent(event)));
  }

  /**
   * Check for and notify about overdue deliveries
   */
  static async notifyOverdueDeliveries(): Promise<void> {
    // This would be called by a scheduled job
    const overdueThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    console.log('Checking for overdue deliveries...', { overdueThreshold });

    // In a real implementation, this would:
    // 1. Query orders with status WAITING_FOR_STOCK or PARTIALLY_SUPPLIED
    // 2. Check against expected delivery dates
    // 3. Send notifications to purchasing team
    // 4. Escalate to management if severely overdue

    // For now, we'll just log that this feature exists
    console.log('Overdue delivery notifications would be sent here');
  }

  /**
   * Send low stock alerts when receiving updates inventory
   */
  static async notifyLowStockAlert(
    productId: string,
    currentStock: number,
    reorderLevel: number
  ): Promise<void> {
    if (currentStock <= reorderLevel) {
      const event: NotificationEvent = {
        type: 'LOW_STOCK_ALERT',
        orderId: 'N/A',
        orderNumber: 0,
        customerName: 'N/A',
        data: {
          skuId: productId,
          currentStock,
          reorderLevel,
          shortage: reorderLevel - currentStock,
          severity:
            currentStock <= 0 ? 'CRITICAL' : currentStock <= reorderLevel * 0.5 ? 'HIGH' : 'MEDIUM',
        },
        timestamp: new Date(),
      };

      await this._processNotificationEvent(event);
    }
  }

  /**
   * Process a single notification event
   */
  private static async _processNotificationEvent(event: NotificationEvent): Promise<void> {
    try {
      console.log('Processing notification event:', {
        type: event.type,
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        timestamp: event.timestamp,
        data: event.data,
      });

      // In a real implementation, this would:
      // 1. Send email notifications to relevant users
      // 2. Send SMS/WhatsApp alerts for urgent events
      // 3. Create in-app notifications
      // 4. Log to notification history
      // 5. Integrate with external systems (Slack, Teams, etc.)

      // For now, we'll simulate different notification channels
      await this._sendEmailNotification(event);
      await this._sendInAppNotification(event);

      if (this._isUrgentEvent(event)) {
        await this._sendUrgentAlert(event);
      }
    } catch (error) {
      console.error('Failed to process notification event:', error);
      // Don't throw - notifications shouldn't break the receiving flow
    }
  }

  /**
   * Send email notification
   */
  private static async _sendEmailNotification(event: NotificationEvent): Promise<void> {
    // In a real implementation, this would integrate with your email service
    console.log(`[EMAIL] ${event.type}: Order #${event.orderNumber} - ${event.customerName}`);

    switch (event.type) {
      case 'ITEM_RECEIVED':
        console.log(`  Received ${event.data.quantityReceived} units of ${event.data.skuCode}`);
        break;
      case 'ORDER_FULLY_RECEIVED':
        console.log(`  All items received for order #${event.orderNumber}`);
        break;
      case 'ORDER_STATUS_CHANGED':
        console.log(
          `  Status changed from ${event.data.previousStatus} to ${event.data.newStatus}`
        );
        break;
      case 'LOW_STOCK_ALERT':
        console.log(
          `  Low stock alert: ${event.data.currentStock} units remaining (reorder at ${event.data.reorderLevel})`
        );
        break;
    }
  }

  /**
   * Send in-app notification
   */
  private static async _sendInAppNotification(event: NotificationEvent): Promise<void> {
    // In a real implementation, this would create database records for in-app notifications
    console.log(`[IN-APP] ${event.type}: ${this._getNotificationMessage(event)}`);
  }

  /**
   * Send urgent alert (SMS, push notification, etc.)
   */
  private static async _sendUrgentAlert(event: NotificationEvent): Promise<void> {
    // In a real implementation, this would send SMS or push notifications
    console.log(`[URGENT] ${event.type}: ${this._getNotificationMessage(event)}`);
  }

  /**
   * Check if an event requires urgent notification
   */
  private static _isUrgentEvent(event: NotificationEvent): boolean {
    switch (event.type) {
      case 'LOW_STOCK_ALERT':
        return event.data.severity === 'CRITICAL';
      case 'ORDER_STATUS_CHANGED':
        return event.data.newStatus === 'INSTALL_SCHEDULING'; // Ready for installation
      case 'RECEIVING_OVERDUE':
        return true;
      default:
        return false;
    }
  }

  /**
   * Get human-readable notification message
   */
  private static _getNotificationMessage(event: NotificationEvent): string {
    switch (event.type) {
      case 'ITEM_RECEIVED':
        return `Received ${event.data.quantityReceived} units of ${event.data.skuCode} for order #${event.orderNumber}`;
      case 'ORDER_FULLY_RECEIVED':
        return `Order #${event.orderNumber} (${event.customerName}) is fully received and ready for scheduling`;
      case 'ORDER_STATUS_CHANGED':
        return `Order #${event.orderNumber} status changed to ${event.data.newStatus}`;
      case 'LOW_STOCK_ALERT':
        return `Low stock alert: ${event.data.currentStock} units remaining (${event.data.severity} priority)`;
      case 'RECEIVING_OVERDUE':
        return `Overdue delivery alert for order #${event.orderNumber}`;
      default:
        return `Notification: ${event.type}`;
    }
  }
}

/**
 * Scheduled job functions for receiving notifications
 */
export class ReceivingNotificationJobs {
  /**
   * Daily job to check for overdue deliveries
   */
  static async checkOverdueDeliveries(): Promise<void> {
    try {
      await ReceivingNotificationService.notifyOverdueDeliveries();
    } catch (error) {
      console.error('Failed to check overdue deliveries:', error);
    }
  }

  /**
   * Job to send receiving reminders to suppliers
   */
  static async sendSupplierReminders(): Promise<void> {
    try {
      console.log('Sending supplier reminders for pending deliveries...');
      // In a real implementation, this would:
      // 1. Query orders with pending deliveries
      // 2. Group by supplier
      // 3. Send email reminders to suppliers
      // 4. Log reminder history
    } catch (error) {
      console.error('Failed to send supplier reminders:', error);
    }
  }
}
