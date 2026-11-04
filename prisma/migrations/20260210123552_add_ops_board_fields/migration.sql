-- Add operational board fields to OrderItem
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "sent_to_supplier_at" TIMESTAMP(3);
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "estimated_supply_at" TIMESTAMP(3);

-- Add operational board cache fields to Order
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ops_status" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ops_lane" TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "order_items_sent_to_supplier_at_idx" ON "order_items"("sent_to_supplier_at");
CREATE INDEX IF NOT EXISTS "order_items_estimated_supply_at_idx" ON "order_items"("estimated_supply_at");
CREATE INDEX IF NOT EXISTS "orders_ops_lane_idx" ON "orders"("ops_lane");
