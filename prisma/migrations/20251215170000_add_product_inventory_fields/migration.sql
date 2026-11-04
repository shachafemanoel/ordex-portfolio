-- AlterTable: Add inventory fields to products table
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "stock" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reorder_level" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: Add indexes for performance
CREATE INDEX IF NOT EXISTS "products_stock_idx" ON "products"("stock");
CREATE INDEX IF NOT EXISTS "products_is_active_idx" ON "products"("is_active");

-- Comment
COMMENT ON COLUMN "products"."stock" IS 'Current stock level for the product';
COMMENT ON COLUMN "products"."reorder_level" IS 'Minimum stock level before reordering';
COMMENT ON COLUMN "products"."is_active" IS 'Whether the product is currently active';
COMMENT ON COLUMN "products"."description" IS 'Product description';
