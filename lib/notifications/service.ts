import { buildSmartNotifications } from '@/lib/notifications/engine';
import { UserRole } from '@prisma/client';

export type NotificationSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type CombinedNotification = {
  id: string;
  title: string;
  message: string;
  body?: string; // iOS compatibility
  severity: NotificationSeverity;
  type?: string; // iOS compatibility
  category?: string;
  timestamp: string;
  createdAt?: string; // iOS compatibility
  read: boolean;
  link?: string | null;
  actionLabel?: string | null;
  metadata?: Record<string, any> | null;
  isPersistent: boolean; // true = DB, false = Smart
};

export class NotificationService {
  /**
   * Create a persistent notification for a specific user
   * @deprecated Persistent notifications are disabled
   */
  static async createNotification(_data: {
    userId: string;
    title: string;
    message: string;
    severity?: NotificationSeverity;
    link?: string;
    metadata?: Record<string, any>;
  }) {
    // No-op: DB table removed
    return { id: 'noop', ..._data, createdAt: new Date() };
  }

  /**
   * Broadcast a notification to all users with a specific role
   * @deprecated Persistent notifications are disabled
   */
  static async broadcastNotification(_data: {
    role: UserRole;
    title: string;
    message: string;
    severity?: NotificationSeverity;
    link?: string;
    metadata?: Record<string, any>;
  }) {
    // No-op
  }

  /**
   * Get all notifications for a user (Smart Only)
   */
  static async getUserNotifications(_userId: string): Promise<CombinedNotification[]> {
    let smartNotifications = [];
    try {
      smartNotifications = await buildSmartNotifications();
    } catch (error) {
      console.error('[NotificationService] Failed to build smart notifications', error);
      return [];
    }

    // 2. Transform to CombinedNotification
    const mappedSmart: any[] = smartNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      body: n.message, // iOS compatibility
      severity: this.mapSeverity(n.severity),
      type: n.severity, // iOS compatibility
      category: n.category,
      timestamp: n.timestamp,
      createdAt: n.timestamp, // iOS compatibility
      read: false,
      link: n.actionUrl,
      actionLabel: n.actionLabel ?? null,
      metadata: n.metadata,
      isPersistent: false,
    }));

    // 3. Sort by timestamp
    return mappedSmart.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Mark a persistent notification as read
   * @deprecated
   */
  static async markAsRead(_userId: string, _notificationId: string) {
    // No-op
  }

  /**
   * Mark all persistent notifications as read
   * @deprecated
   */
  static async markAllAsRead(_userId: string) {
    // No-op
  }

  /**
   * Dismiss a smart notification
   * @deprecated Dismissal table removed
   */
  static async dismissSmartNotification(_userId: string, _notificationId: string) {
    // No-op
  }

  /**
   * Delete a persistent notification
   * @deprecated
   */
  static async deleteNotification(_userId: string, _notificationId: string) {
    // No-op
    return false;
  }

  private static mapSeverity(severity: string): NotificationSeverity {
    switch (severity) {
      case 'critical':
        return 'CRITICAL';
      case 'warning':
        return 'WARNING';
      case 'info':
      default:
        return 'INFO';
    }
  }
}
