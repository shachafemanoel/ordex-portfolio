import { prisma } from '@/lib/db';
import { NotificationSeverity } from '@prisma/client';

export class ProactiveNotifierService {
  /**
   * Sends a notification to a specific user.
   */
  async notifyUser(
    userId: string,
    title: string,
    message: string,
    severity: NotificationSeverity = 'INFO',
    metadata?: Record<string, any>
  ) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          title,
          message,
          severity,
          metadata: metadata || {},
          read: false,
        },
      });
      return notification;
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Broadcasts a notification to all users with a specific role (e.g., ADMIN).
   */
  async broadcastToRole(
    role: 'ADMIN' | 'SALES' | 'OPERATIONS',
    title: string,
    message: string,
    severity: NotificationSeverity = 'INFO'
  ) {
    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true },
    });

    const notifications = await Promise.all(
      users.map((user) => this.notifyUser(user.id, title, message, severity))
    );

    return notifications.length;
  }
}

export const proactiveNotifier = new ProactiveNotifierService();
