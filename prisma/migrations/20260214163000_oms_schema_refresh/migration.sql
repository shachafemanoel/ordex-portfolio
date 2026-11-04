-- OMS schema refresh:
-- 1) Add centralized app settings table
-- 2) Add composite/operational indexes for core OMS workloads

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" VARCHAR(120) NOT NULL,
  "value" JSONB NOT NULL,
  "category" VARCHAR(50) NOT NULL DEFAULT 'general',
  "description" TEXT,
  "is_secret" BOOLEAN NOT NULL DEFAULT false,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_updated_by_id_fkey'
  ) THEN
    ALTER TABLE "app_settings"
    ADD CONSTRAINT "app_settings_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_app_settings_category" ON "app_settings"("category");
CREATE INDEX IF NOT EXISTS "idx_app_settings_updated_at" ON "app_settings"("updated_at");

CREATE INDEX IF NOT EXISTS "idx_customers_name" ON "customers"("name");
CREATE INDEX IF NOT EXISTS "idx_customers_city" ON "customers"("city");

CREATE INDEX IF NOT EXISTS "idx_calendar_events_assignee_start" ON "calendar_events"("assigned_to", "start_time");
CREATE INDEX IF NOT EXISTS "idx_calendar_events_status_start" ON "calendar_events"("status", "start_time");

CREATE INDEX IF NOT EXISTS "idx_users_is_active" ON "users"("is_active");
CREATE INDEX IF NOT EXISTS "idx_users_active_role" ON "users"("is_active", "role");

CREATE INDEX IF NOT EXISTS "idx_products_default_supplier" ON "products"("default_supplier_id");
CREATE INDEX IF NOT EXISTS "idx_products_active_stock" ON "products"("is_active", "stock");

CREATE INDEX IF NOT EXISTS "idx_tasks_assignee_status_due" ON "tasks"("assignee_id", "status", "due_at");
CREATE INDEX IF NOT EXISTS "idx_tasks_status_priority_due" ON "tasks"("status", "priority", "due_at");

CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs"("created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity_created" ON "audit_logs"("entity", "created_at");

CREATE INDEX IF NOT EXISTS "idx_reminders_status_attempts_schedule" ON "reminders"("status", "attempts", "scheduled_at");

CREATE INDEX IF NOT EXISTS "idx_notifications_user_read_created" ON "notifications"("user_id", "read", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_notifications_severity_created" ON "notifications"("severity", "created_at");

CREATE INDEX IF NOT EXISTS "idx_calendar_items_assignee_status_due" ON "calendar_items"("assigned_to_id", "status", "due_date");
CREATE INDEX IF NOT EXISTS "idx_calendar_items_order_id" ON "calendar_items"("order_id");

CREATE INDEX IF NOT EXISTS "idx_event_logs_user_id" ON "event_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_event_logs_type" ON "event_logs"("type");
CREATE INDEX IF NOT EXISTS "idx_event_logs_created_at" ON "event_logs"("created_at");

CREATE INDEX IF NOT EXISTS "idx_order_logs_user_id" ON "order_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_order_logs_created_at" ON "order_logs"("created_at");
CREATE INDEX IF NOT EXISTS "idx_order_logs_action" ON "order_logs"("action");
