-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "supplier_snapshot" JSONB;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "eta_date" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3);
