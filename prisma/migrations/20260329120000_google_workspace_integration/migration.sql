-- CreateEnum
CREATE TYPE "GoogleWorkspaceIntegrationStatus" AS ENUM ('ACTIVE', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "CalendarEventKind" AS ENUM ('INSTALLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "GoogleCalendarSyncStatus" AS ENUM ('NOT_LINKED', 'PENDING', 'SYNCED', 'ERROR', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OperationalMessageKind" AS ENUM (
  'MISSING_DETAILS_REQUEST',
  'ORDER_CONFIRMATION',
  'INSTALLATION_CONFIRMATION',
  'INSTALLATION_REMINDER',
  'PURCHASE_REQUEST_SUPPLIER',
  'CUSTOM'
);

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN "event_kind" "CalendarEventKind" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "calendar_events" ADD COLUMN "google_html_link" TEXT;
ALTER TABLE "calendar_events" ADD COLUMN "google_sync_status" "GoogleCalendarSyncStatus" NOT NULL DEFAULT 'NOT_LINKED';
ALTER TABLE "calendar_events" ADD COLUMN "google_last_synced_at" TIMESTAMP(3);
ALTER TABLE "calendar_events" ADD COLUMN "google_last_error" TEXT;

-- AlterTable
ALTER TABLE "message_logs" ADD COLUMN "subject" VARCHAR(998);
ALTER TABLE "message_logs" ADD COLUMN "idempotency_key" VARCHAR(128);
ALTER TABLE "message_logs" ADD COLUMN "purchase_order_id" UUID;
ALTER TABLE "message_logs" ADD COLUMN "supplier_id" UUID;
ALTER TABLE "message_logs" ADD COLUMN "message_kind" "OperationalMessageKind";

-- AlterTable
ALTER TABLE "message_templates" ADD COLUMN "subject" VARCHAR(998);
ALTER TABLE "message_templates" ADD COLUMN "operational_kind" "OperationalMessageKind";

-- CreateTable
CREATE TABLE "workspace_google_integrations" (
    "id" UUID NOT NULL,
    "store_id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "status" "GoogleWorkspaceIntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "connected_email" VARCHAR(320) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "refresh_token_cipher" BYTEA NOT NULL,
    "refresh_token_iv" BYTEA NOT NULL,
    "refresh_token_tag" BYTEA NOT NULL,
    "access_token_cipher" BYTEA,
    "access_token_iv" BYTEA,
    "access_token_tag" BYTEA,
    "access_token_expires_at" TIMESTAMP(3),
    "last_token_error" TEXT,
    "connected_by_user_id" UUID,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_google_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_google_integrations_store_id_key" ON "workspace_google_integrations"("store_id");

-- CreateIndex
CREATE INDEX "idx_workspace_google_integration_status" ON "workspace_google_integrations"("status");

-- AddForeignKey
ALTER TABLE "workspace_google_integrations" ADD CONSTRAINT "workspace_google_integrations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_google_integrations" ADD CONSTRAINT "workspace_google_integrations_connected_by_user_id_fkey" FOREIGN KEY ("connected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "message_logs_idempotency_key_key" ON "message_logs"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_message_logs_purchase_order_id" ON "message_logs"("purchase_order_id");

-- CreateIndex
CREATE INDEX "idx_message_logs_supplier_id" ON "message_logs"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_calendar_events_order_kind" ON "calendar_events"("order_id", "event_kind");

-- Backfill: rows already linked to Google on an order are installation + synced
UPDATE "calendar_events"
SET "event_kind" = 'INSTALLATION',
    "google_sync_status" = 'SYNCED'
WHERE "order_id" IS NOT NULL AND "google_id" IS NOT NULL;

-- At most one INSTALLATION calendar row per order (PostgreSQL partial unique)
CREATE UNIQUE INDEX "calendar_events_one_installation_per_order"
ON "calendar_events" ("order_id")
WHERE "event_kind" = 'INSTALLATION';
