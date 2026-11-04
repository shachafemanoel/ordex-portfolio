-- Add WooCommerce integration fields to Product
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "woo_id" INTEGER;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "woo_parent_id" INTEGER;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "store_id" VARCHAR(255) NOT NULL DEFAULT 'default';

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "products_woo_id_key" ON "products"("woo_id");
CREATE INDEX IF NOT EXISTS "products_parent_id_idx" ON "products"("parent_id");
CREATE INDEX IF NOT EXISTS "products_woo_id_idx" ON "products"("woo_id");
CREATE INDEX IF NOT EXISTS "products_woo_parent_id_idx" ON "products"("woo_parent_id");
CREATE INDEX IF NOT EXISTS "products_store_id_idx" ON "products"("store_id");

-- Add foreign key constraint for parent-child relationship
ALTER TABLE "products" ADD CONSTRAINT "products_parent_id_fkey" 
  FOREIGN KEY ("parent_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
