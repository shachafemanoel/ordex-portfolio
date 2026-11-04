/**
 * Reminder normalization utilities
 */

export interface ReminderDTO {
  id: string;
  orderId?: string | null;
  templateId?: string | null;
  channel: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  attempts: number;
  createdAt: string;
}

export function normalizeReminder(reminder: any): ReminderDTO | null {
  if (!reminder || !reminder.id) return null;

  return {
    id: reminder.id,
    orderId: reminder.orderId || null,
    templateId: reminder.templateId || null,
    channel: reminder.channel || 'SMS',
    status: reminder.status || 'PENDING',
    scheduledAt: reminder.scheduledAt ? new Date(reminder.scheduledAt).toISOString() : new Date().toISOString(),
    sentAt: reminder.sentAt ? new Date(reminder.sentAt).toISOString() : null,
    attempts: reminder.attempts || 0,
    createdAt: reminder.createdAt ? new Date(reminder.createdAt).toISOString() : new Date().toISOString(),
  };
}

export function normalizeReminders(reminders: any[]): ReminderDTO[] {
  if (!Array.isArray(reminders)) return [];
  return reminders.map(normalizeReminder).filter((r): r is ReminderDTO => r !== null);
}
