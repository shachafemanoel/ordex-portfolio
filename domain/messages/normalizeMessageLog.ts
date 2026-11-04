/**
 * Message log normalization utilities
 * Ensures consistent message log data structure across the application
 */

export interface MessageLogDTO {
  id: string;
  orderId?: string | null;
  templateId?: string | null;
  channel: string;
  to: string;
  body: string;
  provider?: string | null;
  externalId?: string | null;
  status: string;
  error?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

/**
 * Normalizes a message log object from various sources (Prisma, API, legacy)
 */
export function normalizeMessageLog(messageLog: any): MessageLogDTO | null {
  if (!messageLog || !messageLog.id) return null;

  // Extract channel (handle both enum and string)
  const channel = messageLog.channel || 'SMS';

  // Extract status
  const status = messageLog.status || 'PENDING';

  // Extract sent timestamp
  const sentAt = messageLog.sentAt
    ? new Date(messageLog.sentAt).toISOString()
    : null;

  // Extract created timestamp
  const createdAt = messageLog.createdAt
    ? new Date(messageLog.createdAt).toISOString()
    : new Date().toISOString();

  return {
    id: messageLog.id,
    orderId: messageLog.orderId || null,
    templateId: messageLog.templateId || null,
    channel,
    to: messageLog.to || '',
    body: messageLog.body || '',
    provider: messageLog.provider || null,
    externalId: messageLog.externalId || null,
    status,
    error: messageLog.error || null,
    sentAt,
    createdAt,
  };
}

/**
 * Normalizes an array of message logs
 */
export function normalizeMessageLogs(messageLogs: any[]): MessageLogDTO[] {
  if (!Array.isArray(messageLogs)) return [];
  return messageLogs.map(normalizeMessageLog).filter((m): m is MessageLogDTO => m !== null);
}
