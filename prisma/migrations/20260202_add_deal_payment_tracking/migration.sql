-- AlterTable Deal: Add conversion and payment tracking fields
ALTER TABLE "deals"
  ADD COLUMN "converted_order_id" UUID,
  ADD COLUMN "converted_at" TIMESTAMP(3),
  ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "paid_amount_cents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Payment: Make orderId optional, add dealId
ALTER TABLE "payments"
  ALTER COLUMN "order_id" DROP NOT NULL,
  ADD COLUMN "deal_id" UUID;

-- AlterTable Task: Add dealId
ALTER TABLE "tasks"
  ADD COLUMN "deal_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "deals_converted_order_id_key" ON "deals"("converted_order_id");
CREATE INDEX "deals_converted_order_id_idx" ON "deals"("converted_order_id");
CREATE INDEX "deals_payment_status_idx" ON "deals"("payment_status");
CREATE INDEX "payments_deal_id_idx" ON "payments"("deal_id");
CREATE INDEX "tasks_deal_id_idx" ON "tasks"("deal_id");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_converted_order_id_fkey"
  FOREIGN KEY ("converted_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add CHECK constraints for XOR logic (PostgreSQL 12+)
-- Payment must have orderId XOR dealId
ALTER TABLE "payments" ADD CONSTRAINT "payment_entity_xor_check"
  CHECK (
    (order_id IS NOT NULL AND deal_id IS NULL) OR
    (order_id IS NULL AND deal_id IS NOT NULL)
  );

-- Task can have neither (global task) OR one of orderId/dealId
ALTER TABLE "tasks" ADD CONSTRAINT "task_entity_check"
  CHECK (
    (order_id IS NULL AND deal_id IS NULL) OR
    (order_id IS NOT NULL AND deal_id IS NULL) OR
    (order_id IS NULL AND deal_id IS NOT NULL)
  );
