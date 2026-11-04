-- The schema gained these fields without a migration, so a database built from the
-- migration chain alone fails every query that reads order items or addresses.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "installed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "installed_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "formatted_address" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "place_id" VARCHAR(255);

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'OPERATIONS';
