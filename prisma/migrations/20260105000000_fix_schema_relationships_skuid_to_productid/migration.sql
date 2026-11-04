-- Migration: fix_schema_relationships_skuid_to_productid
-- Created: 2026-01-05
-- Description: Fix schema relationships - ensure productId column exists and fix other relationships
-- UPDATED: Made idempotent to handle cases where migration already applied

-- 1. Rename OrderItem.skuId → productId (IDEMPOTENT VERSION)
-- Only rename if sku_id exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'order_items'
    AND column_name = 'sku_id'
  ) THEN
    ALTER TABLE "order_items" RENAME COLUMN "sku_id" TO "product_id";

    -- Update indexes
    DROP INDEX IF EXISTS "order_items_sku_id_idx";
    DROP INDEX IF EXISTS "order_items_order_id_sku_id_idx";
    CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items"("product_id");
    CREATE INDEX IF NOT EXISTS "order_items_order_id_product_id_idx" ON "order_items"("order_id", "product_id");
  ELSE
    -- Column already renamed or doesn't exist, ensure indexes exist
    CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items"("product_id");
    CREATE INDEX IF NOT EXISTS "order_items_order_id_product_id_idx" ON "order_items"("order_id", "product_id");
  END IF;
END $$;

-- 2. Make ReceivingItem.orderItemId required (NOT NULL) - IDEMPOTENT
DO $$
BEGIN
  -- First, ensure all existing rows have orderItemId (if any are NULL)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'receiving_items'
    AND column_name = 'order_item_id'
    AND is_nullable = 'YES'
  ) THEN
    UPDATE "receiving_items"
    SET "order_item_id" = (
      SELECT "id" FROM "order_items" ORDER BY "created_at" DESC LIMIT 1
    )
    WHERE "order_item_id" IS NULL AND EXISTS (SELECT 1 FROM "order_items");

    -- Now make it NOT NULL
    ALTER TABLE "receiving_items" ALTER COLUMN "order_item_id" SET NOT NULL;
  END IF;
END $$;

-- 3. InstallationSlot → InstallationTask merge - IDEMPOTENT
-- Add location fields to InstallationTask if they don't exist
ALTER TABLE "installation_tasks" ADD COLUMN IF NOT EXISTS "location_city" TEXT;
ALTER TABLE "installation_tasks" ADD COLUMN IF NOT EXISTS "location_address" TEXT;
ALTER TABLE "installation_tasks" ADD COLUMN IF NOT EXISTS "location_notes" TEXT;

-- Migrate data from InstallationSlot if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'installation_slots') THEN
    -- Merge data from InstallationSlot to InstallationTask
    UPDATE "installation_tasks" t
    SET
      "location_city" = COALESCE(t."location_city", s."city"),
      "location_address" = COALESCE(t."location_address", s."address"),
      "location_notes" = COALESCE(t."location_notes", s."notes")
    FROM "installation_slots" s
    WHERE t."id" = s."task_id";

    -- Drop InstallationSlot table
    DROP TABLE "installation_slots" CASCADE;
  END IF;
END $$;

-- 4. PaymentInstallment.payment relation (if FK doesn't exist) - IDEMPOTENT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_installments_payment_id_fkey'
  ) THEN
    ALTER TABLE "payment_installments"
    ADD CONSTRAINT "payment_installments_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
