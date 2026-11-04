CREATE TABLE IF NOT EXISTS "store_configurations" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'default',
  "store_name" VARCHAR(120) NOT NULL DEFAULT 'Ordex Store',
  "store_email" VARCHAR(320),
  "store_phone" VARCHAR(64),
  "store_address_line" TEXT,
  "store_city" VARCHAR(120),
  "default_currency" CHAR(3) NOT NULL DEFAULT 'ILS',
  "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Jerusalem',
  "language" VARCHAR(10) NOT NULL DEFAULT 'he',
  "tax_rate_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
  "auto_purchase_order" BOOLEAN NOT NULL DEFAULT true,
  "order_number_prefix" VARCHAR(20) NOT NULL DEFAULT 'ORD-',
  "use_store_address_as_warehouse" BOOLEAN NOT NULL DEFAULT true,
  "warehouse_address_line" TEXT,
  "warehouse_city" VARCHAR(120),
  "warehouse_lat" DOUBLE PRECISION,
  "warehouse_lng" DOUBLE PRECISION,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "store_configurations_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'store_configurations_updated_by_id_fkey'
  ) THEN
    ALTER TABLE "store_configurations"
    ADD CONSTRAINT "store_configurations_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_store_configurations_updated_at"
ON "store_configurations"("updated_at");
