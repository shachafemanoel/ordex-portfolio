import { z } from 'zod';
import type { AuthenticatedUser } from '@/lib/auth';
import type { AssistantState } from '@/lib/assistant/stateStore';
import type { UIPayload } from '@/lib/assistant/uiPayloadSchema';
import { reportActions } from '@/lib/assistant/actionHandlers/reports';
import { mapActions } from '@/lib/assistant/actionHandlers/map';
import { orderActions } from '@/lib/assistant/actionHandlers/orders';
import { calendarActions } from '@/lib/assistant/actionHandlers/calendar';
import { reminderActions } from '@/lib/assistant/actionHandlers/reminders';

export interface ActionContext {
  contextKey: string;
  user: AuthenticatedUser;
  state: AssistantState;
}

export interface ActionDefinition<TParams extends z.ZodTypeAny> {
  id: string;
  paramsSchema: TParams;
  handler: (params: z.infer<TParams>, ctx: ActionContext) => Promise<UIPayload>;
  rbac?: Array<AuthenticatedUser['role'] | 'ANY'>;
}

export type ActionRegistry = Record<string, ActionDefinition<z.ZodTypeAny>>;

const registry: ActionRegistry = {
  ...reportActions,
  ...mapActions,
  ...orderActions,
  ...calendarActions,
  ...reminderActions,
};

export function getActionDefinition(actionId: string): ActionDefinition<z.ZodTypeAny> | undefined {
  return registry[actionId];
}

export function listActionIds(): string[] {
  return Object.keys(registry);
}
