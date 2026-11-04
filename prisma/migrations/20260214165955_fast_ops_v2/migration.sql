-- DropForeignKey
ALTER TABLE IF EXISTS "order_task_events" DROP CONSTRAINT IF EXISTS "order_task_events_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "order_task_events" DROP CONSTRAINT IF EXISTS "order_task_events_order_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "order_task_events" DROP CONSTRAINT IF EXISTS "order_task_events_task_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "order_tasks" DROP CONSTRAINT IF EXISTS "order_tasks_order_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "order_tasks" DROP CONSTRAINT IF EXISTS "order_tasks_performed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "orders" DROP CONSTRAINT IF EXISTS "orders_active_task_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "orders_active_task_id_key";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN IF EXISTS "active_task_id";

-- DropTable
DROP TABLE IF EXISTS "order_task_events";

-- DropTable
DROP TABLE IF EXISTS "order_tasks";

-- DropEnum
DROP TYPE IF EXISTS "OrderTaskType";

-- DropEnum
DROP TYPE IF EXISTS "TaskColor";

-- DropEnum
DROP TYPE IF EXISTS "TaskEventType";
