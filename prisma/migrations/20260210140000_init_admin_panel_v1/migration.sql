-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'OPTIMIZED', 'APPLIED');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY', 'PICKUP', 'INSTALLATION');

-- CreateEnum
CREATE TYPE "ScheduleMode" AS ENUM ('SPECIFIC_TIME', 'TIME_WINDOW', 'ANYTIME');

-- CreateEnum
CREATE TYPE "InventoryTxType" AS ENUM ('PURCHASE', 'SALE', 'RESERVATION', 'RELEASE', 'ADJUSTMENT', 'RETURN');

-- CreateEnum
CREATE TYPE "CalendarItemType" AS ENUM ('EVENT', 'TASK', 'INSTALLATION', 'MEETING', 'REMINDER');

-- CreateEnum
CREATE TYPE "CalendarItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SyncProvider" AS ENUM ('GOOGLE', 'OUTLOOK', 'APPLE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT_CONFIRMATION', 'APPOINTMENT_REMINDER_1HOUR', 'APPOINTMENT_REMINDER_1DAY', 'APPOINTMENT_REMINDER_1WEEK', 'APPOINTMENT_DELAY', 'INSTALLATION_COMPLETE');

-- CreateEnum
CREATE TYPE "DeferBucket" AS ENUM ('TODAY', 'TOMORROW');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'ORDERED', 'RECEIVED', 'INSTALLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskLabel" AS ENUM ('VERIFY_PAYMENT', 'CALLBACK_CUSTOMER', 'VERIFY_STOCK', 'CREATE_PURCHASE_ORDER', 'WAIT_SUPPLIER_DELIVERY', 'RECEIVE_GOODS_PARTIAL', 'SCHEDULE_INSTALLATION', 'WAIT_INSTALLATION_DAY', 'CLOSE_ORDER', 'VERIFY_ORDER', 'ASSIGN_SUPPLIERS', 'RECEIVE_GOODS');

-- CreateEnum
CREATE TYPE "MessageTemplateTarget" AS ENUM ('SUPPLIER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'OPS', 'ADMIN');

-- AlterEnum
ALTER TYPE "InstallationTaskStatus" ADD VALUE 'APPLIED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'RECEIVED';
ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE 'READY';
ALTER TYPE "OrderStatus" ADD VALUE 'IN_TRANSIT';
ALTER TYPE "OrderStatus" ADD VALUE 'INSTALLATION';
ALTER TYPE "OrderStatus" ADD VALUE 'INSTALLED';
ALTER TYPE "OrderStatus" ADD VALUE 'CLOSED';
ALTER TYPE "OrderStatus" ADD VALUE 'ON_HOLD';
ALTER TYPE "OrderStatus" ADD VALUE 'REFUNDED';

-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'VARIABLE';

-- DropForeignKey
ALTER TABLE "message_logs" DROP CONSTRAINT "message_logs_template_id_fkey";

-- DropForeignKey
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_template_id_fkey";

-- AlterTable
ALTER TABLE "_OrderLabels" ADD CONSTRAINT "_OrderLabels_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_OrderLabels_AB_unique";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SUCCESS';

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "city" VARCHAR(120);

-- AlterTable
ALTER TABLE "deal_notes" ADD COLUMN     "demo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "id_maps" ADD COLUMN     "entity_type" TEXT,
ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "internal_id" TEXT;

-- AlterTable
ALTER TABLE "inbound_orders" ADD COLUMN     "enriched_at" TIMESTAMP(3),
ADD COLUMN     "enrichment_data" JSONB,
ADD COLUMN     "last_sync_at" TIMESTAMP(3),
ADD COLUMN     "sync_status" TEXT;

-- AlterTable
ALTER TABLE "installation_tasks" ADD COLUMN     "address" VARCHAR(255),
ADD COLUMN     "city" VARCHAR(120),
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "plan_id" UUID,
ADD COLUMN     "plan_item_id" UUID;

-- AlterTable
ALTER TABLE "labels" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "message_logs" ADD COLUMN     "demo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "priority" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "is_tax_included" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "original_price_cents" INTEGER,
ADD COLUMN     "status" "OrderItemStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "was_on_sale" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "blocked_at" TIMESTAMP(3),
ADD COLUMN     "blocked_by_user_id" UUID,
ADD COLUMN     "blocked_note" TEXT,
ADD COLUMN     "blocked_reason_code" TEXT,
ADD COLUMN     "business_status" TEXT,
ADD COLUMN     "checklist_state" JSONB,
ADD COLUMN     "defer_bucket" "DeferBucket",
ADD COLUMN     "delivery_assigned_to_id" UUID,
ADD COLUMN     "enrichment_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fulfillment_type" "FulfillmentType" NOT NULL DEFAULT 'DELIVERY',
ADD COLUMN     "items_checklist" JSONB,
ADD COLUMN     "last_action_at" TIMESTAMP(3),
ADD COLUMN     "last_enrichment_at" TIMESTAMP(3),
ADD COLUMN     "notes_to_crew" TEXT,
ADD COLUMN     "ops_checklist_state" JSONB,
ADD COLUMN     "ops_current_task" TEXT,
ADD COLUMN     "ops_snooze_reason" TEXT,
ADD COLUMN     "ops_snooze_until" TIMESTAMP(3),
ADD COLUMN     "order_checklist" JSONB,
ADD COLUMN     "order_number" TEXT,
ADD COLUMN     "priority_boost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "schedule_mode" "ScheduleMode" NOT NULL DEFAULT 'ANYTIME',
ADD COLUMN     "scheduled_end" TIMESTAMP(3),
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN     "status_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status_sub" TEXT,
ADD COLUMN     "task_label" TEXT,
ADD COLUMN     "time_window_end" TEXT,
ADD COLUMN     "time_window_start" TEXT,
ADD COLUMN     "urgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "woo_order_id_webhook" TEXT,
ADD COLUMN     "working_by_user_id" UUID,
ADD COLUMN     "working_started_at" TIMESTAMP(3);
-- ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_available" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promo_ends_at" TIMESTAMP(3),
ADD COLUMN     "promo_starts_at" TIMESTAMP(3),
ADD COLUMN     "sale_price_cents" INTEGER,
ADD COLUMN     "woo_sku" TEXT,
ALTER COLUMN "store_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "quote_items" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "sku" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "quotes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "number" SET DATA TYPE TEXT,
ALTER COLUMN "customer_name" SET DATA TYPE TEXT,
ALTER COLUMN "customer_email" SET DATA TYPE TEXT,
ALTER COLUMN "customer_phone" SET DATA TYPE TEXT,
ALTER COLUMN "discount_code" SET DATA TYPE TEXT,
ALTER COLUMN "converted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "abandoned_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "estimated_delivery_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "demo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "status_history" ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "notes" TEXT,
ALTER COLUMN "gov_id" DROP NOT NULL,
ALTER COLUMN "address" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "demo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_auto_generated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trigger_event_id" TEXT;

-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN     "provider_id" TEXT;

-- DropTable
DROP TABLE "store_settings";

-- DropTable
DROP TABLE "templates";

-- CreateTable
CREATE TABLE "installation_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" TIMESTAMPTZ(6) NOT NULL,
    "technician_id" UUID,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "route_summary" TEXT,
    "total_duration" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "installation_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_plan_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seq" INTEGER,
    "type" TEXT,
    "time_window_start" TEXT,
    "time_window_end" TEXT,
    "duration_minutes" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installation_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_checkpoints" (
    "scope" VARCHAR(100) NOT NULL,
    "last_after_iso" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_checkpoints_pkey" PRIMARY KEY ("scope")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" UUID NOT NULL,
    "woo_customer_id" INTEGER,
    "email" TEXT,
    "full_name" TEXT,
    "phone" TEXT,
    "address_json" JSONB,
    "last_order_at" TIMESTAMP(3),
    "first_order_at" TIMESTAMP(3),
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "total_spend" TEXT NOT NULL DEFAULT '0',
    "order_ids" JSONB,
    "currency" TEXT DEFAULT 'ILS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_installations" (
    "woo_order_id_webhook" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "order_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_installations_pkey" PRIMARY KEY ("woo_order_id_webhook")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "target" "MessageTemplateTarget" NOT NULL DEFAULT 'CUSTOMER',
    "content" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_snippets" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ui_labels" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'he',
    "value" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_items" (
    "id" UUID NOT NULL,
    "type" "CalendarItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CalendarItemStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority",
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "assigned_to_id" UUID,
    "created_by_id" UUID NOT NULL,
    "order_id" UUID,
    "task_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_calendar_sync" (
    "id" UUID NOT NULL,
    "calendar_item_id" UUID NOT NULL,
    "provider" "SyncProvider" NOT NULL,
    "external_id" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_errors" JSONB,

    CONSTRAINT "external_calendar_sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID,
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    "quantity_reserved" INTEGER NOT NULL DEFAULT 0,
    "quantity_available" INTEGER NOT NULL DEFAULT 0,
    "reorder_point" INTEGER NOT NULL DEFAULT 0,
    "reorder_quantity" INTEGER NOT NULL DEFAULT 1,
    "last_restocked" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "inventory_item_id" UUID NOT NULL,
    "type" "InventoryTxType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_type" TEXT,
    "reference_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_executions" (
    "id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "user_id" UUID,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "agent_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_notifications" (
    "id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "action_url" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocoding_cache" (
    "id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "place_id" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geocoding_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_configs" (
    "id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "status_label" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "expected_duration_days" INTEGER,
    "expected_duration_text" TEXT,
    "display_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_status_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_timelines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "stage_label" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "expected_completion" TIMESTAMP(3),
    "actual_completion" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_cache" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_jobs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_mappings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InstallationPlanToOrder" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_InstallationPlanToOrder_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "event_logs_order_id_idx" ON "event_logs"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_woo_customer_id_key" ON "customer_profiles"("woo_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_email_key" ON "customer_profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_name_key" ON "message_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "help_snippets_key_key" ON "help_snippets"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ui_labels_key_key" ON "ui_labels"("key");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_items_task_id_key" ON "calendar_items"("task_id");

-- CreateIndex
CREATE INDEX "calendar_items_assigned_to_id_idx" ON "calendar_items"("assigned_to_id");

-- CreateIndex
CREATE INDEX "calendar_items_start_time_idx" ON "calendar_items"("start_time");

-- CreateIndex
CREATE INDEX "calendar_items_due_date_idx" ON "calendar_items"("due_date");

-- CreateIndex
CREATE INDEX "calendar_items_type_status_idx" ON "calendar_items"("type", "status");

-- CreateIndex
CREATE INDEX "calendar_items_created_by_id_idx" ON "calendar_items"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_calendar_sync_calendar_item_id_key" ON "external_calendar_sync"("calendar_item_id");

-- CreateIndex
CREATE INDEX "external_calendar_sync_provider_sync_enabled_idx" ON "external_calendar_sync"("provider", "sync_enabled");

-- CreateIndex
CREATE INDEX "external_calendar_sync_last_synced_at_idx" ON "external_calendar_sync"("last_synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_calendar_sync_provider_external_id_key" ON "external_calendar_sync"("provider", "external_id");

-- CreateIndex
CREATE INDEX "inventory_items_product_id_idx" ON "inventory_items"("product_id");

-- CreateIndex
CREATE INDEX "inventory_items_supplier_id_idx" ON "inventory_items"("supplier_id");

-- CreateIndex
CREATE INDEX "inventory_items_quantity_available_idx" ON "inventory_items"("quantity_available");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_product_id_supplier_id_key" ON "inventory_items"("product_id", "supplier_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_inventory_item_id_idx" ON "inventory_transactions"("inventory_item_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_reference_type_reference_id_idx" ON "inventory_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_created_at_idx" ON "inventory_transactions"("created_at");

-- CreateIndex
CREATE INDEX "agent_executions_user_id_agent_name_idx" ON "agent_executions"("user_id", "agent_name");

-- CreateIndex
CREATE INDEX "agent_executions_status_idx" ON "agent_executions"("status");

-- CreateIndex
CREATE INDEX "agent_notifications_user_id_read_idx" ON "agent_notifications"("user_id", "read");

-- CreateIndex
CREATE UNIQUE INDEX "geocoding_cache_address_key" ON "geocoding_cache"("address");

-- CreateIndex
CREATE UNIQUE INDEX "order_status_configs_status_key" ON "order_status_configs"("status");

-- CreateIndex
CREATE INDEX "order_timelines_order_id_idx" ON "order_timelines"("order_id");

-- CreateIndex
CREATE INDEX "order_timelines_stage_idx" ON "order_timelines"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "ai_cache_hash_key" ON "ai_cache"("hash");

-- CreateIndex
CREATE INDEX "ai_insights_created_at_idx" ON "ai_insights"("created_at");

-- CreateIndex
CREATE INDEX "ai_insights_is_read_idx" ON "ai_insights"("is_read");

-- CreateIndex
CREATE INDEX "ai_insights_type_idx" ON "ai_insights"("type");

-- CreateIndex
CREATE UNIQUE INDEX "import_mappings_name_key" ON "import_mappings"("name");

-- CreateIndex
CREATE INDEX "_InstallationPlanToOrder_B_index" ON "_InstallationPlanToOrder"("B");

-- CreateIndex
CREATE UNIQUE INDEX "id_maps_source_id_entity_type_external_id_key" ON "id_maps"("source_id", "entity_type", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_woo_order_id_key" ON "orders"("woo_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_woo_order_id_webhook_key" ON "orders"("woo_order_id_webhook");

-- CreateIndex
CREATE INDEX "idx_orders_snooze" ON "orders"("ops_snooze_until", "ops_lane");

-- CreateIndex
CREATE INDEX "idx_orders_working_by" ON "orders"("working_by_user_id");

-- AddForeignKey
ALTER TABLE "inbound_orders" ADD CONSTRAINT "inbound_orders_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_working_by_user_id_fkey" FOREIGN KEY ("working_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_assigned_to_id_fkey" FOREIGN KEY ("delivery_assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_plans" ADD CONSTRAINT "installation_plans_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_plan_items" ADD CONSTRAINT "installation_plan_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_plan_items" ADD CONSTRAINT "installation_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "installation_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_calendar_sync" ADD CONSTRAINT "external_calendar_sync_calendar_item_id_fkey" FOREIGN KEY ("calendar_item_id") REFERENCES "calendar_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_notifications" ADD CONSTRAINT "agent_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_timelines" ADD CONSTRAINT "order_timelines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstallationPlanToOrder" ADD CONSTRAINT "_InstallationPlanToOrder_A_fkey" FOREIGN KEY ("A") REFERENCES "installation_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstallationPlanToOrder" ADD CONSTRAINT "_InstallationPlanToOrder_B_fkey" FOREIGN KEY ("B") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
