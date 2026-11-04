-- WooCommerce intake, stage 1: connection state for each business's store.
ALTER TABLE "woo_integrations"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'CONNECTED',
  ADD COLUMN "webhook_ids" JSONB,
  ADD COLUMN "last_event_at" TIMESTAMP(3),
  ADD COLUMN "last_error" TEXT,
  ADD COLUMN "service_user_id" UUID;
