/**
 * Smart Notification System
 * מערכת התראות חכמות מסונכרנות עם משימות
 *
 * Features:
 * - קישור אוטומטי בין משימות להתראות
 * - בחירה חכמה של זמן ושיטת התראה
 * - התראות חוזרות למשימות שלא טופלו
 * - אופטימיזציה של עומס התראות
 */

import { prisma } from '@/lib/db';
import { NotificationChannel, TaskPriority, TaskType } from '@prisma/client';

/**
 * Smart notification configuration
 */
export interface SmartNotificationConfig {
  // Timing
  immediateForUrgent?: boolean; // Send immediately for urgent tasks
  reminderBeforeDue?: number; // Hours before due to send reminder
  retryAfterHours?: number; // Hours to wait before retry
  maxRetries?: number; // Maximum number of retries

  // Channels
  preferredChannel?: NotificationChannel;
  fallbackChannel?: NotificationChannel;

  // Business hours
  respectBusinessHours?: boolean;
  businessHoursStart?: number; // 9 AM
  businessHoursEnd?: number; // 18 PM

  // Batching
  batchNotifications?: boolean; // Group multiple notifications
  batchWindowMinutes?: number; // Time window for batching
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: SmartNotificationConfig = {
  immediateForUrgent: true,
  reminderBeforeDue: 4,
  retryAfterHours: 24,
  maxRetries: 2,
  preferredChannel: 'SMS',
  fallbackChannel: 'EMAIL',
  respectBusinessHours: true,
  businessHoursStart: 9,
  businessHoursEnd: 18,
  batchNotifications: false,
  batchWindowMinutes: 30,
};

/**
 * Notification Result
 */
export interface NotificationResult {
  reminderId: string;
  taskId: string;
  channel: NotificationChannel;
  scheduledAt: Date;
  immediate: boolean;
}

/**
 * Create smart notification for a task
 * יוצר התראה חכמה עבור משימה עם אופטימיזציה של זמן וערוץ
 */
export async function createSmartNotification(
  taskId: string,
  config: Partial<SmartNotificationConfig> = {}
): Promise<NotificationResult | null> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Fetch task with order details
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      order: {
        include: {
          customer: true,
        },
      },
      assignee: true,
    },
  });

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Check if notification already exists
  const existingReminder = await prisma.reminder.findFirst({
    where: {
      orderId: task.orderId,
      status: { in: ['PENDING', 'SENT'] },
    },
  });

  if (existingReminder) {
    console.log(`[Smart Notifications] Notification already exists for task ${taskId}`);
    return null;
  }

  // Determine notification timing
  const scheduledAt = calculateOptimalNotificationTime(task, finalConfig);

  // Select notification channel
  const channel = selectOptimalChannel(task, finalConfig);

  // Check customer preferences
  if (task.order?.customer) {
    /*
    const customerPrefs = await getCustomerNotificationPreferences(task.order.customer.phone || '');
    if (customerPrefs) {
      // Respect customer opt-out
      if (customerPrefs.isOptedOut) {
        console.log(
          `[Smart Notifications] Customer opted out, skipping notification for task ${taskId}`
        );
        return null;
      }

      // Use preferred channel if available
      if (customerPrefs.preferredMethod !== 'DISABLED') {
        // Map to our channel enum
        const preferredChannel = mapPreferenceToChannel(customerPrefs.preferredMethod);
        if (preferredChannel) {
          // Override with customer preference
        }
      }
    }
    */
  }

  // Create reminder
  const reminder = await prisma.reminder.create({
    data: {
      orderId: task.orderId,
      channel,
      status: 'PENDING',
      scheduledAt,
    },
  });

  console.log(
    `[Smart Notifications] Created notification ${reminder.id} for task ${taskId}, scheduled at ${scheduledAt.toISOString()}`
  );

  return {
    reminderId: reminder.id,
    taskId: task.id,
    channel,
    scheduledAt,
    immediate: scheduledAt <= new Date(),
  };
}

/**
 * Create notifications for all open tasks without reminders
 * יוצר התראות לכל המשימות הפתוחות שאין להן התראה
 */
export async function syncNotificationsForOpenTasks(
  config: Partial<SmartNotificationConfig> = {}
): Promise<{
  tasksProcessed: number;
  notificationsCreated: number;
  notificationsSkipped: number;
}> {
  // Find open tasks without reminders
  const openTasks = await prisma.task.findMany({
    where: {
      status: 'OPEN',
      orderId: { not: null },
    },
    include: {
      order: {
        include: {
          reminders: {
            where: {
              status: { in: ['PENDING', 'SENT'] },
            },
          },
        },
      },
    },
  });

  let notificationsCreated = 0;
  let notificationsSkipped = 0;

  for (const task of openTasks) {
    try {
      // Skip if order already has pending/sent reminder
      if (task.order?.reminders && task.order.reminders.length > 0) {
        notificationsSkipped++;
        continue;
      }

      const result = await createSmartNotification(task.id, config);
      if (result) {
        notificationsCreated++;
      } else {
        notificationsSkipped++;
      }
    } catch (error) {
      console.error(
        `[Smart Notifications] Error creating notification for task ${task.id}:`,
        error
      );
      notificationsSkipped++;
    }
  }

  console.log(
    `[Smart Notifications] Sync complete: ${notificationsCreated} created, ${notificationsSkipped} skipped out of ${openTasks.length} tasks`
  );

  return {
    tasksProcessed: openTasks.length,
    notificationsCreated,
    notificationsSkipped,
  };
}

/**
 * Create retry notification for failed tasks
 * יוצר התראת תזכורת למשימות שלא טופלו
 */
export async function createRetryNotificationsForOverdueTasks(
  config: Partial<SmartNotificationConfig> = {}
): Promise<{
  tasksFound: number;
  notificationsCreated: number;
}> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Find overdue tasks
  const now = new Date();
  const overdueTasks = await prisma.task.findMany({
    where: {
      status: 'OPEN',
      dueAt: { lt: now },
      orderId: { not: null },
    },
    include: {
      order: {
        include: {
          reminders: {
            where: {
              status: { in: ['PENDING', 'SENT'] },
            },
            orderBy: {
              scheduledAt: 'desc',
            },
          },
        },
      },
    },
  });

  let notificationsCreated = 0;

  for (const task of overdueTasks) {
    try {
      // Check retry count
      const existingReminders = task.order?.reminders || [];
      if (existingReminders.length >= (finalConfig.maxRetries || 2)) {
        console.log(`[Smart Notifications] Max retries reached for task ${task.id}`);
        continue;
      }

      // Check if enough time passed since last reminder
      if (existingReminders.length > 0) {
        const lastReminder = existingReminders[0];
        const hoursSinceLastReminder =
          (now.getTime() - lastReminder.scheduledAt.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastReminder < (finalConfig.retryAfterHours || 24)) {
          console.log(`[Smart Notifications] Too soon to retry for task ${task.id}`);
          continue;
        }
      }

      // Create retry notification
      const result = await createSmartNotification(task.id, {
        ...finalConfig,
        immediateForUrgent: true, // Always immediate for retries
      });

      if (result) {
        notificationsCreated++;
      }
    } catch (error) {
      console.error(
        `[Smart Notifications] Error creating retry notification for task ${task.id}:`,
        error
      );
    }
  }

  console.log(
    `[Smart Notifications] Created ${notificationsCreated} retry notifications for ${overdueTasks.length} overdue tasks`
  );

  return {
    tasksFound: overdueTasks.length,
    notificationsCreated,
  };
}

/**
 * Calculate optimal notification time
 * מחשב את הזמן האופטימלי לשליחת התראה
 */
function calculateOptimalNotificationTime(task: any, config: SmartNotificationConfig): Date {
  const now = new Date();

  // Immediate for urgent tasks
  if (config.immediateForUrgent && task.priority === TaskPriority.URGENT) {
    return now;
  }

  // Calculate based on due date
  if (task.dueAt) {
    const dueAt = new Date(task.dueAt);
    const reminderBeforeDueMs = (config.reminderBeforeDue || 4) * 60 * 60 * 1000;
    const reminderTime = new Date(dueAt.getTime() - reminderBeforeDueMs);

    // If reminder time is in the past, send immediately
    if (reminderTime <= now) {
      return now;
    }

    // Adjust for business hours if needed
    if (config.respectBusinessHours) {
      return adjustForBusinessHours(reminderTime, config);
    }

    return reminderTime;
  }

  // Default: based on priority
  let hoursDelay = 24; // Low priority
  if (task.priority === TaskPriority.HIGH) {
    hoursDelay = 2;
  } else if (task.priority === TaskPriority.MEDIUM) {
    hoursDelay = 8;
  }

  const scheduledTime = new Date(now.getTime() + hoursDelay * 60 * 60 * 1000);

  if (config.respectBusinessHours) {
    return adjustForBusinessHours(scheduledTime, config);
  }

  return scheduledTime;
}

/**
 * Adjust notification time to business hours
 * מתאים את זמן ההתראה לשעות העבודה
 */
function adjustForBusinessHours(time: Date, config: SmartNotificationConfig): Date {
  const hour = time.getHours();
  const businessStart = config.businessHoursStart || 9;
  const businessEnd = config.businessHoursEnd || 18;

  // If within business hours, return as-is
  if (hour >= businessStart && hour < businessEnd) {
    return time;
  }

  // If before business hours, move to start of business hours
  if (hour < businessStart) {
    const adjusted = new Date(time);
    adjusted.setHours(businessStart, 0, 0, 0);
    return adjusted;
  }

  // If after business hours, move to next business day start
  const adjusted = new Date(time);
  adjusted.setDate(adjusted.getDate() + 1);
  adjusted.setHours(businessStart, 0, 0, 0);
  return adjusted;
}

/**
 * Select optimal notification channel
 * בוחר את הערוץ האופטימלי להתראה
 */
function selectOptimalChannel(task: any, config: SmartNotificationConfig): NotificationChannel {
  // Urgent tasks: prefer SMS/WhatsApp for immediate attention
  if (task.priority === TaskPriority.URGENT) {
    return task.order?.customerPhone ? 'SMS' : 'EMAIL';
  }

  // Installation reminders: prefer WhatsApp for rich messaging
  if (task.type === TaskType.INSTALL_REMINDER) {
    return task.order?.customerPhone ? 'WHATSAPP' : 'EMAIL';
  }

  // Default: use configured preferred channel
  if (config.preferredChannel) {
    return config.preferredChannel;
  }

  // Fallback: SMS if phone available, otherwise EMAIL
  return task.order?.customerPhone ? 'SMS' : 'EMAIL';
}

/**
 * Get customer notification preferences
 */
async function getCustomerNotificationPreferences(phone: string) {
  try {
    // CustomerNotificationPreferences model missing/deleted
    console.warn('[Smart Notifications] Customer preferences storage not available');
    return null;
    /*
    return await prisma.customerNotificationPreferences.findUnique({
      where: { customerPhone: phone },
    });
    */
  } catch (error) {
    console.error('[Smart Notifications] Error fetching customer preferences:', error);
    return null;
  }
}

/**
 * Map notification method to channel
 */
function mapPreferenceToChannel(method: string): NotificationChannel | null {
  switch (method) {
    case 'SMS':
      return 'SMS';
    case 'WHATSAPP':
      return 'WHATSAPP';
    case 'EMAIL':
      return 'EMAIL';
    default:
      return null;
  }
}

/**
 * Cancel notifications for a task
 * מבטל התראות למשימה שנסגרה
 */
export async function cancelNotificationsForTask(taskId: string): Promise<number> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { orderId: true },
  });

  if (!task || !task.orderId) {
    return 0;
  }

  const result = await prisma.reminder.updateMany({
    where: {
      orderId: task.orderId,
      status: 'PENDING',
    },
    data: {
      status: 'CANCELLED',
    },
  });

  console.log(`[Smart Notifications] Cancelled ${result.count} notifications for task ${taskId}`);

  return result.count;
}

/**
 * Batch notifications for efficiency
 * מקבץ התראות לשליחה יעילה
 */
export async function batchPendingNotifications(windowMinutes: number = 30): Promise<{
  totalBatches: number;
  totalNotifications: number;
}> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);

  // Find notifications scheduled in the window
  const pendingReminders = await prisma.reminder.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: {
        gte: now,
        lte: windowEnd,
      },
    },
    include: {
      order: {
        include: {
          customer: true,
        },
      },
    },
  });

  // Group by customer and channel
  const batches = new Map<string, typeof pendingReminders>();

  for (const reminder of pendingReminders) {
    const key = `${reminder.order?.customer?.phone || 'unknown'}-${reminder.channel}`;
    if (!batches.has(key)) {
      batches.set(key, []);
    }
    batches.get(key)!.push(reminder);
  }

  console.log(
    `[Smart Notifications] Found ${batches.size} batches with ${pendingReminders.length} notifications`
  );

  return {
    totalBatches: batches.size,
    totalNotifications: pendingReminders.length,
  };
}

/**
 * Export main API
 */
export const SmartNotifications = {
  createSmartNotification,
  syncNotificationsForOpenTasks,
  createRetryNotificationsForOverdueTasks,
  cancelNotificationsForTask,
  batchPendingNotifications,
};

export default SmartNotifications;
