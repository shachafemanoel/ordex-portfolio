-- Restore the purchase_orders table expected by the Prisma PurchaseOrder model.
-- This migration is idempotent and safe to run on environments where the table already exists.

CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "linked_order_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "reference" TEXT NOT NULL,
    "supplier_snapshot" JSONB,
    "eta_date" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "supplier_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "eta_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "purchase_orders"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "demo" SET DEFAULT false,
  ALTER COLUMN "linked_order_ids" SET DEFAULT ARRAY[]::UUID[];

UPDATE "purchase_orders"
SET "linked_order_ids" = ARRAY[]::UUID[]
WHERE "linked_order_ids" IS NULL;

ALTER TABLE "purchase_orders"
  ALTER COLUMN "linked_order_ids" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_reference_key"
  ON "purchase_orders"("reference");

CREATE INDEX IF NOT EXISTS "purchase_orders_supplier_id_idx"
  ON "purchase_orders"("supplier_id");

CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx"
  ON "purchase_orders"("status");

CREATE INDEX IF NOT EXISTS "purchase_orders_created_at_idx"
  ON "purchase_orders"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_supplier_id_fkey'
  ) THEN
    ALTER TABLE "purchase_orders"
      ADD CONSTRAINT "purchase_orders_supplier_id_fkey"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.purchase_order_items') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_purchase_order_id_fkey'
    )
  THEN
    ALTER TABLE "purchase_order_items"
      ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey"
      FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.goods_receipts') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipts_purchase_order_id_fkey'
    )
  THEN
    ALTER TABLE "goods_receipts"
      ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey"
      FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_order_items_purchase_order_id_product_id_key"
  ON "purchase_order_items"("purchase_order_id", "product_id");
