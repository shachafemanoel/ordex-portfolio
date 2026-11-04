-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('ADMIN', 'OPERATIONS');

-- DropIndex
DROP INDEX "inbound_orders_source_source_order_id_key";

-- DropIndex
DROP INDEX "orders_number_key";

-- DropIndex
DROP INDEX "orders_woo_order_id_key";

-- DropIndex
DROP INDEX "orders_order_number_key";

-- DropIndex
DROP INDEX "orders_woo_order_id_webhook_key";

-- DropIndex
DROP INDEX "push_subscriptions_endpoint_key";

-- DropIndex
DROP INDEX "products_sku_key";

-- DropIndex
DROP INDEX "products_woo_id_key";

-- DropIndex
DROP INDEX "discounts_code_key";

-- DropIndex
DROP INDEX "categories_name_key";

-- DropIndex
DROP INDEX "categories_slug_key";

-- DropIndex
DROP INDEX "tags_name_key";

-- DropIndex
DROP INDEX "idempotency_keys_key_key";

-- DropIndex
DROP INDEX "external_calendar_sync_provider_external_id_key";

-- DropIndex
DROP INDEX "geocoding_cache_address_key";

-- DropIndex
DROP INDEX "labels_name_key";

-- DropIndex
DROP INDEX "order_status_configs_status_key";

-- DropIndex
DROP INDEX "ai_cache_hash_key";

-- DropIndex
DROP INDEX "import_mappings_name_key";

-- DropIndex
DROP INDEX "AIAgentConfig_agentType_key";

-- DropIndex
DROP INDEX "AIAgentCache_key_key";

-- DropIndex
DROP INDEX "message_logs_idempotency_key_key";

-- DropIndex
DROP INDEX "message_templates_name_key";

-- DropIndex
DROP INDEX "help_snippets_key_key";

-- DropIndex
DROP INDEX "ui_labels_key_key";

-- DropIndex
DROP INDEX "purchase_orders_reference_key";

-- AlterTable
ALTER TABLE "inbound_orders" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "installation_plans" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "installation_plan_items" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "installation_tasks" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "payment_plans" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "payment_installments" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "customer_ledger_entries" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "push_subscriptions" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "delivery_route_sessions" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "store_configurations" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "workspace_google_integrations" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "installer_profiles" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "event_logs" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "sales_profiles" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "ops_profiles" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "bundle_items" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "discounts" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "discount_products" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "discount_usages" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "status_history" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "order_notes" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "idempotency_keys" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "assistant_states" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "calendar_items" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "external_calendar_sync" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "geocoding_cache" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "labels" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "order_status_configs" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "order_timelines" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "ai_cache" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "ai_insights" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "data_import_jobs" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "import_mappings" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "AIAgentConfig" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "AIRiskAssessment" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "AIFinancialInsight" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "AISupplyChainInsight" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "AIAgentLog" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "AIAgentCache" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "ops_actions" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "order_logs" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "order_exceptions" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "message_logs" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "message_templates" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "notification_dismissals" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "help_snippets" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "ui_labels" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "inventory_transactions" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "agent_executions" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "agent_notifications" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "sku_suppliers" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "product_suppliers" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "receiving_items" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'legacy';

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'OPERATIONS',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invitations" (
    "tenant_id" TEXT NOT NULL DEFAULT 'legacy',
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'OPERATIONS',
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "woo_integrations" (
    "tenant_id" TEXT NOT NULL DEFAULT 'legacy',
    "id" UUID NOT NULL,
    "base_url" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_sync_at" TIMESTAMP(3),

    CONSTRAINT "woo_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "woo_sync_jobs" (
    "tenant_id" TEXT NOT NULL DEFAULT 'legacy',
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "object_id" TEXT,
    "topic" TEXT,
    "dedup_key" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "progress" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "woo_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "tenant_id" TEXT NOT NULL DEFAULT 'legacy',
    "id" UUID NOT NULL,
    "worker_id" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_memberships_user_id_is_active_idx" ON "tenant_memberships"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_user_id_key" ON "tenant_memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invitations_token_hash_key" ON "tenant_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "tenant_invitations_tenant_id_idx" ON "tenant_invitations"("tenant_id");

-- CreateIndex
CREATE INDEX "woo_integrations_tenant_id_idx" ON "woo_integrations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "woo_integrations_tenant_id_key" ON "woo_integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "woo_sync_jobs_state_available_at_locked_until_idx" ON "woo_sync_jobs"("state", "available_at", "locked_until");

-- CreateIndex
CREATE INDEX "woo_sync_jobs_tenant_id_idx" ON "woo_sync_jobs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "woo_sync_jobs_tenant_id_integration_id_dedup_key_key" ON "woo_sync_jobs"("tenant_id", "integration_id", "dedup_key");

-- CreateIndex
CREATE INDEX "worker_heartbeats_tenant_id_idx" ON "worker_heartbeats"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "worker_heartbeats_tenant_id_worker_id_key" ON "worker_heartbeats"("tenant_id", "worker_id");

-- CreateIndex
CREATE INDEX "inbound_orders_tenant_id_idx" ON "inbound_orders"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_orders_tenant_id_source_source_order_id_key" ON "inbound_orders"("tenant_id", "source", "source_order_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");

-- CreateIndex
CREATE INDEX "addresses_tenant_id_idx" ON "addresses"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_tenant_id_idx" ON "orders"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_number_key" ON "orders"("tenant_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_woo_order_id_key" ON "orders"("tenant_id", "woo_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_order_number_key" ON "orders"("tenant_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_woo_order_id_webhook_key" ON "orders"("tenant_id", "woo_order_id_webhook");

-- CreateIndex
CREATE INDEX "installation_plans_tenant_id_idx" ON "installation_plans"("tenant_id");

-- CreateIndex
CREATE INDEX "installation_plan_items_tenant_id_idx" ON "installation_plan_items"("tenant_id");

-- CreateIndex
CREATE INDEX "installation_tasks_tenant_id_idx" ON "installation_tasks"("tenant_id");

-- CreateIndex
CREATE INDEX "order_items_tenant_id_idx" ON "order_items"("tenant_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_plans_tenant_id_idx" ON "payment_plans"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_installments_tenant_id_idx" ON "payment_installments"("tenant_id");

-- CreateIndex
CREATE INDEX "customer_ledger_entries_tenant_id_idx" ON "customer_ledger_entries"("tenant_id");

-- CreateIndex
CREATE INDEX "shipments_tenant_id_idx" ON "shipments"("tenant_id");

-- CreateIndex
CREATE INDEX "calendar_events_tenant_id_idx" ON "calendar_events"("tenant_id");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenant_id_idx" ON "push_subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_tenant_id_endpoint_key" ON "push_subscriptions"("tenant_id", "endpoint");

-- CreateIndex
CREATE INDEX "delivery_route_sessions_tenant_id_idx" ON "delivery_route_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "store_configurations_tenant_id_idx" ON "store_configurations"("tenant_id");

-- CreateIndex
CREATE INDEX "workspace_google_integrations_tenant_id_idx" ON "workspace_google_integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "installer_profiles_tenant_id_idx" ON "installer_profiles"("tenant_id");

-- CreateIndex
CREATE INDEX "event_logs_tenant_id_idx" ON "event_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "sales_profiles_tenant_id_idx" ON "sales_profiles"("tenant_id");

-- CreateIndex
CREATE INDEX "ops_profiles_tenant_id_idx" ON "ops_profiles"("tenant_id");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_idx" ON "products"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_woo_id_key" ON "products"("tenant_id", "woo_id");

-- CreateIndex
CREATE INDEX "bundle_items_tenant_id_idx" ON "bundle_items"("tenant_id");

-- CreateIndex
CREATE INDEX "discounts_tenant_id_idx" ON "discounts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "discounts_tenant_id_code_key" ON "discounts"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "discount_products_tenant_id_idx" ON "discount_products"("tenant_id");

-- CreateIndex
CREATE INDEX "discount_usages_tenant_id_idx" ON "discount_usages"("tenant_id");

-- CreateIndex
CREATE INDEX "categories_tenant_id_idx" ON "categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_name_key" ON "categories"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_slug_key" ON "categories"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "tags_tenant_id_idx" ON "tags"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_tenant_id_name_key" ON "tags"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "status_history_tenant_id_idx" ON "status_history"("tenant_id");

-- CreateIndex
CREATE INDEX "order_notes_tenant_id_idx" ON "order_notes"("tenant_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_tenant_id_idx" ON "idempotency_keys"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_tenant_id_key_key" ON "idempotency_keys"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "assistant_states_tenant_id_idx" ON "assistant_states"("tenant_id");

-- CreateIndex
CREATE INDEX "calendar_items_tenant_id_idx" ON "calendar_items"("tenant_id");

-- CreateIndex
CREATE INDEX "external_calendar_sync_tenant_id_idx" ON "external_calendar_sync"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_calendar_sync_tenant_id_provider_external_id_key" ON "external_calendar_sync"("tenant_id", "provider", "external_id");

-- CreateIndex
CREATE INDEX "geocoding_cache_tenant_id_idx" ON "geocoding_cache"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "geocoding_cache_tenant_id_address_key" ON "geocoding_cache"("tenant_id", "address");

-- CreateIndex
CREATE INDEX "labels_tenant_id_idx" ON "labels"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "labels_tenant_id_name_key" ON "labels"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "order_status_configs_tenant_id_idx" ON "order_status_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_status_configs_tenant_id_status_key" ON "order_status_configs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "order_timelines_tenant_id_idx" ON "order_timelines"("tenant_id");

-- CreateIndex
CREATE INDEX "ai_cache_tenant_id_idx" ON "ai_cache"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_cache_tenant_id_hash_key" ON "ai_cache"("tenant_id", "hash");

-- CreateIndex
CREATE INDEX "ai_insights_tenant_id_idx" ON "ai_insights"("tenant_id");

-- CreateIndex
CREATE INDEX "data_import_jobs_tenant_id_idx" ON "data_import_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "import_mappings_tenant_id_idx" ON "import_mappings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_mappings_tenant_id_name_key" ON "import_mappings"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "AIAgentConfig_tenant_id_idx" ON "AIAgentConfig"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "AIAgentConfig_tenant_id_agentType_key" ON "AIAgentConfig"("tenant_id", "agentType");

-- CreateIndex
CREATE INDEX "AIRiskAssessment_tenant_id_idx" ON "AIRiskAssessment"("tenant_id");

-- CreateIndex
CREATE INDEX "AIFinancialInsight_tenant_id_idx" ON "AIFinancialInsight"("tenant_id");

-- CreateIndex
CREATE INDEX "AISupplyChainInsight_tenant_id_idx" ON "AISupplyChainInsight"("tenant_id");

-- CreateIndex
CREATE INDEX "AIAgentLog_tenant_id_idx" ON "AIAgentLog"("tenant_id");

-- CreateIndex
CREATE INDEX "AIAgentCache_tenant_id_idx" ON "AIAgentCache"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "AIAgentCache_tenant_id_key_key" ON "AIAgentCache"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "ops_actions_tenant_id_idx" ON "ops_actions"("tenant_id");

-- CreateIndex
CREATE INDEX "order_logs_tenant_id_idx" ON "order_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_idx" ON "audit_events"("tenant_id");

-- CreateIndex
CREATE INDEX "order_exceptions_tenant_id_idx" ON "order_exceptions"("tenant_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_idx" ON "tasks"("tenant_id");

-- CreateIndex
CREATE INDEX "message_logs_tenant_id_idx" ON "message_logs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_logs_tenant_id_idempotency_key_key" ON "message_logs"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "message_templates_tenant_id_idx" ON "message_templates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_tenant_id_name_key" ON "message_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "reminders_tenant_id_idx" ON "reminders"("tenant_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

-- CreateIndex
CREATE INDEX "notification_dismissals_tenant_id_idx" ON "notification_dismissals"("tenant_id");

-- CreateIndex
CREATE INDEX "announcements_tenant_id_idx" ON "announcements"("tenant_id");

-- CreateIndex
CREATE INDEX "help_snippets_tenant_id_idx" ON "help_snippets"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "help_snippets_tenant_id_key_key" ON "help_snippets"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "ui_labels_tenant_id_idx" ON "ui_labels"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ui_labels_tenant_id_key_key" ON "ui_labels"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "inventory_items_tenant_id_idx" ON "inventory_items"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_tenant_id_idx" ON "inventory_transactions"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_executions_tenant_id_idx" ON "agent_executions"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_notifications_tenant_id_idx" ON "agent_notifications"("tenant_id");

-- CreateIndex
CREATE INDEX "sku_suppliers_tenant_id_idx" ON "sku_suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "product_suppliers_tenant_id_idx" ON "product_suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_idx" ON "purchase_orders"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenant_id_reference_key" ON "purchase_orders"("tenant_id", "reference");

-- CreateIndex
CREATE INDEX "purchase_order_items_tenant_id_idx" ON "purchase_order_items"("tenant_id");

-- CreateIndex
CREATE INDEX "receiving_items_tenant_id_idx" ON "receiving_items"("tenant_id");

-- CreateIndex
CREATE INDEX "goods_receipts_tenant_id_idx" ON "goods_receipts"("tenant_id");

INSERT INTO tenants (id,name,is_active,created_at) VALUES ('legacy','עסק קיים',true,CURRENT_TIMESTAMP);
INSERT INTO tenant_memberships (id,tenant_id,user_id,role,is_active,created_at)
SELECT gen_random_uuid(),'legacy',id,CASE WHEN role::text='ADMIN' THEN 'ADMIN'::"TenantRole" ELSE 'OPERATIONS'::"TenantRole" END,is_active,CURRENT_TIMESTAMP FROM users;
-- AddForeignKey
ALTER TABLE "inbound_orders" ADD CONSTRAINT "inbound_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_plans" ADD CONSTRAINT "installation_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_plan_items" ADD CONSTRAINT "installation_plan_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_tasks" ADD CONSTRAINT "installation_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_route_sessions" ADD CONSTRAINT "delivery_route_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_configurations" ADD CONSTRAINT "store_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_google_integrations" ADD CONSTRAINT "workspace_google_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installer_profiles" ADD CONSTRAINT "installer_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_profiles" ADD CONSTRAINT "sales_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_profiles" ADD CONSTRAINT "ops_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_products" ADD CONSTRAINT "discount_products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_states" ADD CONSTRAINT "assistant_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_calendar_sync" ADD CONSTRAINT "external_calendar_sync_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geocoding_cache" ADD CONSTRAINT "geocoding_cache_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_configs" ADD CONSTRAINT "order_status_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_timelines" ADD CONSTRAINT "order_timelines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_cache" ADD CONSTRAINT "ai_cache_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAgentConfig" ADD CONSTRAINT "AIAgentConfig_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRiskAssessment" ADD CONSTRAINT "AIRiskAssessment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFinancialInsight" ADD CONSTRAINT "AIFinancialInsight_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISupplyChainInsight" ADD CONSTRAINT "AISupplyChainInsight_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAgentLog" ADD CONSTRAINT "AIAgentLog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAgentCache" ADD CONSTRAINT "AIAgentCache_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_actions" ADD CONSTRAINT "ops_actions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_logs" ADD CONSTRAINT "order_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_exceptions" ADD CONSTRAINT "order_exceptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_dismissals" ADD CONSTRAINT "notification_dismissals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_snippets" ADD CONSTRAINT "help_snippets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ui_labels" ADD CONSTRAINT "ui_labels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_notifications" ADD CONSTRAINT "agent_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_suppliers" ADD CONSTRAINT "sku_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "woo_integrations" ADD CONSTRAINT "woo_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "woo_sync_jobs" ADD CONSTRAINT "woo_sync_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "woo_sync_jobs" ADD CONSTRAINT "woo_sync_jobs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "woo_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_heartbeats" ADD CONSTRAINT "worker_heartbeats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "inbound_orders" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "inbound_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inbound_orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inbound_orders" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "customers" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customers" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "addresses" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "addresses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "addresses" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "orders" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orders" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "installation_plans" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "installation_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "installation_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "installation_plans" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "installation_plan_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "installation_plan_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "installation_plan_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "installation_plan_items" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "installation_tasks" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "installation_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "installation_tasks" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "installation_tasks" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "order_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_items" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "payments" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payments" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "payment_plans" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "payment_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payment_plans" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "payment_installments" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "payment_installments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_installments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payment_installments" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "customer_ledger_entries" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "customer_ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_ledger_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customer_ledger_entries" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "shipments" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "shipments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "shipments" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "calendar_events" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendar_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "calendar_events" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "push_subscriptions" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "push_subscriptions" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "delivery_route_sessions" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "delivery_route_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_route_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "delivery_route_sessions" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "store_configurations" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "store_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_configurations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "store_configurations" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "workspace_google_integrations" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "workspace_google_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_google_integrations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "workspace_google_integrations" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "installer_profiles" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "installer_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "installer_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "installer_profiles" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "event_logs" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "event_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "event_logs" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "sales_profiles" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "sales_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sales_profiles" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "ops_profiles" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "ops_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ops_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ops_profiles" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "suppliers" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "suppliers" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "products" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "products" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "bundle_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "bundle_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bundle_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bundle_items" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "discounts" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "discounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "discounts" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "discount_products" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "discount_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount_products" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "discount_products" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "discount_usages" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "discount_usages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount_usages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "discount_usages" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "categories" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "categories" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "tags" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tags" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "status_history" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "status_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "status_history" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "order_notes" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "order_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_notes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_notes" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "idempotency_keys" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_keys" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "idempotency_keys" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "assistant_states" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "assistant_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assistant_states" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "assistant_states" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "calendar_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "calendar_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendar_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "calendar_items" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "external_calendar_sync" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "external_calendar_sync" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_calendar_sync" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "external_calendar_sync" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "geocoding_cache" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "geocoding_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "geocoding_cache" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "geocoding_cache" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "labels" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "labels" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "labels" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "order_status_configs" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "order_status_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_status_configs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_status_configs" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "order_timelines" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "order_timelines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_timelines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_timelines" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "ai_cache" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "ai_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_cache" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ai_cache" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "ai_insights" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "ai_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_insights" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ai_insights" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "data_import_jobs" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "data_import_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_import_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "data_import_jobs" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "import_mappings" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "import_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_mappings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "import_mappings" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "AIAgentConfig" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "AIAgentConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIAgentConfig" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AIAgentConfig" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "AIRiskAssessment" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "AIRiskAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIRiskAssessment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AIRiskAssessment" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "AIFinancialInsight" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "AIFinancialInsight" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIFinancialInsight" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AIFinancialInsight" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "AISupplyChainInsight" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "AISupplyChainInsight" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AISupplyChainInsight" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AISupplyChainInsight" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "AIAgentLog" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "AIAgentLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIAgentLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AIAgentLog" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "AIAgentCache" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "AIAgentCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIAgentCache" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AIAgentCache" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "ops_actions" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "ops_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ops_actions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ops_actions" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "order_logs" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "order_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_logs" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "audit_events" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_events" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "order_exceptions" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "order_exceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_exceptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_exceptions" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "tasks" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tasks" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "message_logs" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "message_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "message_logs" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "message_templates" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "message_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "message_templates" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "reminders" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "reminders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reminders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reminders" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "notifications" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notifications" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "notification_dismissals" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "notification_dismissals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_dismissals" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_dismissals" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "announcements" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "announcements" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "help_snippets" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "help_snippets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "help_snippets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "help_snippets" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "ui_labels" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "ui_labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ui_labels" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ui_labels" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "inventory_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_items" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "inventory_transactions" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "inventory_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_transactions" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "agent_executions" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "agent_executions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_executions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "agent_executions" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "agent_notifications" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "agent_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "agent_notifications" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "sku_suppliers" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "sku_suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sku_suppliers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sku_suppliers" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "product_suppliers" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "product_suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_suppliers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product_suppliers" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "purchase_orders" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "purchase_orders" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "purchase_order_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "purchase_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_order_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "purchase_order_items" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "receiving_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "receiving_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receiving_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "receiving_items" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "goods_receipts" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "goods_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goods_receipts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "goods_receipts" USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE "tenant_invitations" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "tenant_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_invitations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_invitations" USING ((tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.identity_lookup', true) = '1')) WITH CHECK ((tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.identity_lookup', true) = '1'));

ALTER TABLE "woo_integrations" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "woo_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "woo_integrations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "woo_integrations" USING ((tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.identity_lookup', true) = '1')) WITH CHECK ((tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.identity_lookup', true) = '1'));

ALTER TABLE "woo_sync_jobs" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "woo_sync_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "woo_sync_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "woo_sync_jobs" USING ((tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.identity_lookup', true) = '1')) WITH CHECK ((tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.identity_lookup', true) = '1'));

ALTER TABLE "worker_heartbeats" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id'::text, true);
ALTER TABLE "worker_heartbeats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "worker_heartbeats" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "worker_heartbeats" USING ((tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.identity_lookup', true) = '1')) WITH CHECK ((tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR current_setting('app.identity_lookup', true) = '1'));

-- Identity lookups are allowed only inside the server's dedicated identity transaction.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY user_identity_read ON "users" FOR SELECT USING (
 current_setting('app.identity_lookup', true) = '1' OR EXISTS (
 SELECT 1 FROM tenant_memberships m WHERE m.user_id = users.id
 AND m.tenant_id = current_setting('app.tenant_id', true) AND m.is_active));
CREATE POLICY user_identity_write ON "users" FOR ALL USING (current_setting('app.identity_lookup', true) = '1') WITH CHECK (current_setting('app.identity_lookup', true) = '1');

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_directory_read ON tenants FOR SELECT USING (
 current_setting('app.identity_lookup', true) = '1' OR EXISTS (
 SELECT 1 FROM tenant_memberships m WHERE m.tenant_id = tenants.id
 AND m.user_id::text = current_setting('app.user_id', true) AND m.is_active));
CREATE POLICY tenant_directory_write ON tenants FOR ALL USING (current_setting('app.identity_lookup', true) = '1') WITH CHECK (current_setting('app.identity_lookup', true) = '1');

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_read ON tenant_memberships FOR SELECT USING (
 current_setting('app.identity_lookup', true) = '1' OR tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY membership_write ON tenant_memberships FOR ALL USING (
 current_setting('app.identity_lookup', true) = '1' OR
 (tenant_id = current_setting('app.tenant_id', true) AND current_setting('app.tenant_role', true) = 'ADMIN')) WITH CHECK (
 current_setting('app.identity_lookup', true) = '1' OR
 (tenant_id = current_setting('app.tenant_id', true) AND current_setting('app.tenant_role', true) = 'ADMIN'));

-- Every foreign key between scoped records must stay inside one business.
CREATE FUNCTION retzef_check_tenant_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE referenced_value text; valid_link boolean;
BEGIN
 referenced_value := to_jsonb(NEW)->>TG_ARGV[0];
 IF referenced_value IS NULL THEN RETURN NEW; END IF;
 IF TG_ARGV[1] = 'users' THEN
  SELECT EXISTS(SELECT 1 FROM tenant_memberships WHERE user_id::text = referenced_value AND tenant_id = NEW.tenant_id AND is_active) INTO valid_link;
 ELSE
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE %I::text = $1 AND tenant_id = $2)', TG_ARGV[1], TG_ARGV[2]) INTO valid_link USING referenced_value, NEW.tenant_id;
 END IF;
 IF NOT valid_link THEN RAISE EXCEPTION 'Referenced record is not available in this business' USING ERRCODE = '23503'; END IF;
 RETURN NEW;
END $$;

DO $$
DECLARE link record;
BEGIN
 FOR link IN
  SELECT c.conname, child.relname child_table, parent.relname parent_table,
    child_col.attname child_column, parent_col.attname parent_column
  FROM pg_constraint c
  JOIN pg_class child ON child.oid=c.conrelid
  JOIN pg_class parent ON parent.oid=c.confrelid
  JOIN pg_attribute child_col ON child_col.attrelid=child.oid AND child_col.attnum=c.conkey[1]
  JOIN pg_attribute parent_col ON parent_col.attrelid=parent.oid AND parent_col.attnum=c.confkey[1]
  WHERE c.contype='f' AND array_length(c.conkey,1)=1 AND child.relname <> 'tenant_memberships'
  AND EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=child.oid AND attname='tenant_id')
  AND (parent.relname='users' OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=parent.oid AND attname='tenant_id'))
 LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION retzef_check_tenant_link(%L,%L,%L)',
   'tenant_link_' || left(md5(link.conname),20), link.child_table, link.child_column, link.parent_table, link.parent_column);
 END LOOP;
END $$;

-- Implicit Prisma many-to-many join tables also need policies; they have no model delegate.
DO $$
DECLARE t record; link record; condition_sql text;
BEGIN
 FOR t IN SELECT relname, oid FROM pg_class WHERE relkind='r' AND relnamespace='public'::regnamespace AND relname LIKE '\_%' ESCAPE '\' AND relname <> '_prisma_migrations'
 LOOP
  condition_sql := '';
  FOR link IN
   SELECT parent.relname parent_table, ca.attname child_column, pa.attname parent_column
   FROM pg_constraint c JOIN pg_class parent ON parent.oid=c.confrelid
   JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1]
   JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[1]
   WHERE c.conrelid=t.oid AND c.contype='f' AND EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=parent.oid AND attname='tenant_id')
  LOOP
   condition_sql := condition_sql || CASE WHEN condition_sql='' THEN '' ELSE ' AND ' END || format('EXISTS(SELECT 1 FROM %I p WHERE p.%I = %I.%I AND p.tenant_id = current_setting(''app.tenant_id'', true))', link.parent_table, link.parent_column, t.relname, link.child_column);
  END LOOP;
  IF condition_sql <> '' THEN
   EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t.relname);
   EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t.relname);
   EXECUTE format('CREATE POLICY tenant_join_isolation ON %I USING (%s) WITH CHECK (%s)',t.relname,condition_sql,condition_sql);
  END IF;
 END LOOP;
END $$;

CREATE POLICY no_hard_delete ON orders AS RESTRICTIVE FOR DELETE USING (false);
CREATE POLICY no_hard_delete ON customers AS RESTRICTIVE FOR DELETE USING (false);
