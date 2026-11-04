export type EventSeverity = 'info' | 'warning' | 'error';

export type EventType =
  | 'ORDER_STATUS'
  | 'ORDER_CREATED'
  | 'PAYMENT'
  | 'INVENTORY'
  | 'USER_ACTIVITY'
  | 'TASK'
  | 'CALENDAR';

export interface EventLogEntry {
  id: string;
  type: EventType;
  entityType: 'order' | 'payment' | 'inventory' | 'user' | 'task' | 'calendar';
  entityId: string;
  title: string;
  message?: string | null;
  status?: string | null;
  severity: EventSeverity;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface EventLogResult {
  items: EventLogEntry[];
  nextCursor?: string | null;
}
