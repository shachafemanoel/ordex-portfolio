/*
  Warnings:

  - You are about to drop the column `task_id` on the `calendar_items` table. All the data in the column will be lost.
  - You are about to drop the column `ai_churn_probability` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `ai_lifetime_value` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `ai_next_best_action` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `ai_sentiment` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `company_size` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `industry` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `last_activity_at` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `linkedin_url` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `demo` on the `message_logs` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `deal_id` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `demo` on the `reminders` table. All the data in the column will be lost.
  - You are about to drop the column `deal_id` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `demo` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `is_auto_generated` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `trigger_event_id` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the `activities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `app_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `campaign_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `campaigns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customer_notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customer_notification_preferences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customer_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customer_segments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `deal_notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `deal_products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `deals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `id_maps` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `installation_slots` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lead_tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `leads` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_status_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_status_outbox` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quote_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quotes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `receiving_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `returns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `segments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `skus` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sync_checkpoints` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_event_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_installations` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[lastRiskAssessmentId]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OpsActionType" AS ENUM ('PURCHASE_APPROVAL', 'STUCK_ORDER_REMINDER', 'TASK_NOTIFY', 'ITEM_SUPPLIER_MISSING', 'ITEM_PROBLEM', 'DELIVERY_COORDINATION', 'INSTALLATION_COORDINATION');

-- CreateEnum
CREATE TYPE "OpsActionStatus" AS ENUM ('OPEN', 'SNOOZED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OpsActionStep" AS ENUM ('AWAITING_DECISION', 'CHOOSING_SUPPLIER', 'AWAITING_SUPPLIER_PHONE', 'CONFIRM_DEFAULT_SUPPLIER', 'DONE');

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_contact_id_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_deal_id_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_user_id_fkey";

-- DropForeignKey
ALTER TABLE "app_settings" DROP CONSTRAINT "app_settings_updated_by_id_fkey";

-- DropForeignKey
ALTER TABLE "calendar_items" DROP CONSTRAINT "calendar_items_task_id_fkey";

-- DropForeignKey
ALTER TABLE "campaign_messages" DROP CONSTRAINT "campaign_messages_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_segment_id_fkey";

-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "customer_notes" DROP CONSTRAINT "customer_notes_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "customer_notes" DROP CONSTRAINT "customer_notes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "customer_segments" DROP CONSTRAINT "customer_segments_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "customer_segments" DROP CONSTRAINT "customer_segments_segment_id_fkey";

-- DropForeignKey
ALTER TABLE "deal_notes" DROP CONSTRAINT "deal_notes_deal_id_fkey";

-- DropForeignKey
ALTER TABLE "deal_notes" DROP CONSTRAINT "deal_notes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "deal_products" DROP CONSTRAINT "deal_products_deal_id_fkey";

-- DropForeignKey
ALTER TABLE "deal_products" DROP CONSTRAINT "deal_products_product_id_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_converted_order_id_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "installation_slots" DROP CONSTRAINT "installation_slots_order_id_fkey";

-- DropForeignKey
ALTER TABLE "installation_slots" DROP CONSTRAINT "installation_slots_technician_id_fkey";

-- DropForeignKey
ALTER TABLE "lead_tags" DROP CONSTRAINT "lead_tags_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_assigned_user_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "order_status_history" DROP CONSTRAINT "order_status_history_order_id_fkey";

-- DropForeignKey
ALTER TABLE "order_status_outbox" DROP CONSTRAINT "order_status_outbox_order_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_deal_id_fkey";

-- DropForeignKey
ALTER TABLE "product_suppliers" DROP CONSTRAINT "product_suppliers_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "quote_items" DROP CONSTRAINT "quote_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "quote_items" DROP CONSTRAINT "quote_items_quote_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_converted_to_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_converted_to_order_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_discount_id_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_follow_up_task_id_fkey";

-- DropForeignKey
ALTER TABLE "receiving_items" DROP CONSTRAINT "receiving_items_order_item_id_fkey";

-- DropForeignKey
ALTER TABLE "receiving_items" DROP CONSTRAINT "receiving_items_sku_id_fkey";

-- DropForeignKey
ALTER TABLE "receiving_logs" DROP CONSTRAINT "receiving_logs_order_item_id_fkey";

-- DropForeignKey
ALTER TABLE "receiving_logs" DROP CONSTRAINT "receiving_logs_received_by_fkey";

-- DropForeignKey
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_message_log_id_fkey";

-- DropForeignKey
ALTER TABLE "returns" DROP CONSTRAINT "returns_order_id_fkey";

-- DropForeignKey
ALTER TABLE "sku_suppliers" DROP CONSTRAINT "sku_suppliers_sku_id_fkey";

-- DropForeignKey
ALTER TABLE "skus" DROP CONSTRAINT "skus_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_deal_id_fkey";

-- DropIndex
DROP INDEX "agent_executions_status_idx";

-- DropIndex
DROP INDEX "agent_executions_user_id_agent_name_idx";

-- DropIndex
DROP INDEX "agent_notifications_user_id_read_idx";

-- DropIndex
DROP INDEX "calendar_items_task_id_key";

-- DropIndex
DROP INDEX "customers_last_activity_at_idx";

-- DropIndex
DROP INDEX "goods_receipts_reference_key";

-- DropIndex
DROP INDEX "inventory_items_product_id_idx";

-- DropIndex
DROP INDEX "inventory_items_quantity_available_idx";

-- DropIndex
DROP INDEX "inventory_items_supplier_id_idx";

-- DropIndex
DROP INDEX "inventory_transactions_created_at_idx";

-- DropIndex
DROP INDEX "inventory_transactions_inventory_item_id_idx";

-- DropIndex
DROP INDEX "inventory_transactions_reference_type_reference_id_idx";

-- DropIndex
DROP INDEX "idx_message_logs_order_sent_at";

-- DropIndex
DROP INDEX "message_logs_channel_status_idx";

-- DropIndex
DROP INDEX "message_logs_order_id_idx";

-- DropIndex
DROP INDEX "message_logs_template_id_idx";

-- DropIndex
DROP INDEX "idx_notifications_severity_created";

-- DropIndex
DROP INDEX "idx_notifications_user_read_created";

-- DropIndex
DROP INDEX "notifications_created_at_idx";

-- DropIndex
DROP INDEX "notifications_user_id_idx";

-- DropIndex
DROP INDEX "idx_orders_ops_queue_sort";

-- DropIndex
DROP INDEX "payments_deal_id_idx";

-- DropIndex
DROP INDEX "product_suppliers_product_id_idx";

-- DropIndex
DROP INDEX "product_suppliers_product_id_supplier_id_key";

-- DropIndex
DROP INDEX "product_suppliers_supplier_id_idx";

-- DropIndex
DROP INDEX "receiving_items_goods_receipt_id_idx";

-- DropIndex
DROP INDEX "receiving_items_order_item_id_idx";

-- DropIndex
DROP INDEX "receiving_items_sku_id_idx";

-- DropIndex
DROP INDEX "idx_reminders_schedule_status";

-- DropIndex
DROP INDEX "idx_reminders_status_attempts_schedule";

-- DropIndex
DROP INDEX "reminders_order_id_idx";

-- DropIndex
DROP INDEX "reminders_scheduled_at_idx";

-- DropIndex
DROP INDEX "reminders_template_id_idx";

-- DropIndex
DROP INDEX "unique_reminder_dedup";

-- DropIndex
DROP INDEX "sku_suppliers_sku_id_idx";

-- DropIndex
DROP INDEX "sku_suppliers_sku_id_supplier_id_key";

-- DropIndex
DROP INDEX "sku_suppliers_supplier_id_idx";

-- DropIndex
DROP INDEX "suppliers_name_idx";

-- DropIndex
DROP INDEX "tasks_assignee_id_idx";

-- DropIndex
DROP INDEX "tasks_deal_id_idx";

-- DropIndex
DROP INDEX "tasks_due_at_idx";

-- DropIndex
DROP INDEX "tasks_order_id_idx";

-- DropIndex
DROP INDEX "tasks_priority_idx";

-- DropIndex
DROP INDEX "tasks_status_idx";

-- DropIndex
DROP INDEX "tasks_type_idx";

-- AlterTable
ALTER TABLE "calendar_items" DROP COLUMN "task_id";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "ai_churn_probability",
DROP COLUMN "ai_lifetime_value",
DROP COLUMN "ai_next_best_action",
DROP COLUMN "ai_sentiment",
DROP COLUMN "company_size",
DROP COLUMN "industry",
DROP COLUMN "last_activity_at",
DROP COLUMN "linkedin_url",
DROP COLUMN "website";

-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "message_logs" DROP COLUMN "demo";

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "priority";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "aiConfidenceLevel" DOUBLE PRECISION,
ADD COLUMN     "aiLastAnalyzedAt" TIMESTAMP(3),
ADD COLUMN     "aiSuggestedAction" TEXT,
ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "lastRiskAssessmentId" UUID;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "deal_id";

-- AlterTable
ALTER TABLE "purchase_orders" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "receiving_items" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "reminders" DROP COLUMN "demo";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "deal_id",
DROP COLUMN "demo",
DROP COLUMN "is_auto_generated",
DROP COLUMN "trigger_event_id";

-- DropTable
DROP TABLE "activities";

-- DropTable
DROP TABLE "app_settings";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "campaign_messages";

-- DropTable
DROP TABLE "campaigns";

-- DropTable
DROP TABLE "contacts";

-- DropTable
DROP TABLE "customer_notes";

-- DropTable
DROP TABLE "customer_notification_preferences";

-- DropTable
DROP TABLE "customer_profiles";

-- DropTable
DROP TABLE "customer_segments";

-- DropTable
DROP TABLE "deal_notes";

-- DropTable
DROP TABLE "deal_products";

-- DropTable
DROP TABLE "deals";

-- DropTable
DROP TABLE "id_maps";

-- DropTable
DROP TABLE "installation_slots";

-- DropTable
DROP TABLE "lead_tags";

-- DropTable
DROP TABLE "leads";

-- DropTable
DROP TABLE "order_status_history";

-- DropTable
DROP TABLE "order_status_outbox";

-- DropTable
DROP TABLE "quote_items";

-- DropTable
DROP TABLE "quotes";

-- DropTable
DROP TABLE "receiving_logs";

-- DropTable
DROP TABLE "returns";

-- DropTable
DROP TABLE "segments";

-- DropTable
DROP TABLE "skus";

-- DropTable
DROP TABLE "sync_checkpoints";

-- DropTable
DROP TABLE "webhook_event_logs";

-- DropTable
DROP TABLE "webhook_events";

-- DropTable
DROP TABLE "webhook_installations";

-- CreateTable
CREATE TABLE "AIAgentConfig" (
    "id" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "systemPrompt" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRiskAssessment" (
    "id" TEXT NOT NULL,
    "orderId" UUID NOT NULL,
    "overallRiskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "riskFactors" TEXT[],
    "recommendations" TEXT[],
    "mitigationActions" TEXT[],
    "agentVersion" TEXT NOT NULL,
    "processingTime" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model" TEXT NOT NULL,
    "tokenUsage" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AIRiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFinancialInsight" (
    "id" TEXT NOT NULL,
    "orderId" UUID NOT NULL,
    "profitMargin" DOUBLE PRECISION,
    "costAnalysis" JSONB,
    "pricingSuggestions" TEXT[],
    "upsellOpportunities" TEXT[],
    "agentVersion" TEXT NOT NULL,
    "processingTime" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIFinancialInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISupplyChainInsight" (
    "id" TEXT NOT NULL,
    "orderId" UUID NOT NULL,
    "supplierReliabilityScore" DOUBLE PRECISION,
    "expectedDelayRisk" DOUBLE PRECISION,
    "alternativeSuppliers" JSONB,
    "logisticsOptimization" TEXT,
    "agentVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AISupplyChainInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAgentLog" (
    "id" TEXT NOT NULL,
    "orderId" UUID,
    "agentType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "duration" INTEGER NOT NULL,
    "tokensUsed" INTEGER,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAgentCache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAgentCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_actions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "type" "OpsActionType" NOT NULL,
    "status" "OpsActionStatus" NOT NULL DEFAULT 'OPEN',
    "step" "OpsActionStep" NOT NULL DEFAULT 'AWAITING_DECISION',
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "context" JSONB,
    "last_notified_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "payload" JSONB,
    "diff" JSONB,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_exceptions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "order_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIAgentConfig_agentType_key" ON "AIAgentConfig"("agentType");

-- CreateIndex
CREATE UNIQUE INDEX "AIAgentCache_key_key" ON "AIAgentCache"("key");

-- CreateIndex
CREATE INDEX "ops_actions_status_snoozed_until_last_notified_at_idx" ON "ops_actions"("status", "snoozed_until", "last_notified_at");

-- CreateIndex
CREATE INDEX "ops_actions_order_id_type_status_idx" ON "ops_actions"("order_id", "type", "status");

-- CreateIndex
CREATE INDEX "audit_events_order_id_idx" ON "audit_events"("order_id");

-- CreateIndex
CREATE INDEX "order_exceptions_order_id_idx" ON "order_exceptions"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_lastRiskAssessmentId_key" ON "orders"("lastRiskAssessmentId");

-- CreateIndex
CREATE INDEX "idx_orders_ops_queue_sort" ON "orders"("deleted_at", "status", "urgent", "scheduled_at", "created_at");

-- CreateIndex
CREATE INDEX "tasks_ai_generated_at_idx" ON "tasks"("ai_generated_at");

-- AddForeignKey
ALTER TABLE "AIRiskAssessment" ADD CONSTRAINT "AIRiskAssessment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFinancialInsight" ADD CONSTRAINT "AIFinancialInsight_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISupplyChainInsight" ADD CONSTRAINT "AISupplyChainInsight_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAgentLog" ADD CONSTRAINT "AIAgentLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_actions" ADD CONSTRAINT "ops_actions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
