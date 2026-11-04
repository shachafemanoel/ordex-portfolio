import { Order, Task } from '@prisma/client';

// Legacy compatibility hooks. Task automations were tied to removed OrderTask* schema and are
// intentionally no-op until the new Task workflow automation is reintroduced.
export async function onTaskCreated(_task: Task, _order: Order) {
  return;
}

export async function onTaskCompleted(_task: Task, _order: Order) {
  return;
}
