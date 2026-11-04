-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHECK', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'BIT', 'PAYPAL', 'STRIPE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- AlterTable payments
-- Step 1: Add new columns as nullable
ALTER TABLE "payments" ADD COLUMN "currency" CHAR(3) DEFAULT 'ILS',
ADD COLUMN "exchange_rate" DECIMAL(10,4),
ADD COLUMN "payment_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "due_date" TIMESTAMP(3),
ADD COLUMN "credit_card_last4" VARCHAR(4),
ADD COLUMN "check_number" VARCHAR(50),
ADD COLUMN "bank_transaction_id" VARCHAR(100),
ADD COLUMN "payment_provider" VARCHAR(50),
ADD COLUMN "receipt_url" VARCHAR(500),
ADD COLUMN "processed_by" UUID,
ADD COLUMN "approved_by" UUID,
ADD COLUMN "metadata" JSONB;

-- Step 2: Add temporary column for new method enum
ALTER TABLE "payments" ADD COLUMN "method_new" "PaymentMethod";

-- Step 3: Migrate existing method data to new enum (best effort mapping)
UPDATE "payments" SET "method_new" = CASE
  WHEN LOWER("method") LIKE '%cash%' OR LOWER("method") LIKE '%מזומן%' THEN 'CASH'::"PaymentMethod"
  WHEN LOWER("method") LIKE '%check%' OR LOWER("method") LIKE '%צ''ק%' OR LOWER("method") LIKE '%המחאה%' THEN 'CHECK'::"PaymentMethod"
  WHEN LOWER("method") LIKE '%transfer%' OR LOWER("method") LIKE '%העברה%' THEN 'BANK_TRANSFER'::"PaymentMethod"
  WHEN LOWER("method") LIKE '%credit%' OR LOWER("method") LIKE '%אשראי%' THEN 'CREDIT_CARD'::"PaymentMethod"
  WHEN LOWER("method") LIKE '%debit%' OR LOWER("method") LIKE '%חיוב%' THEN 'DEBIT_CARD'::"PaymentMethod"
  WHEN LOWER("method") LIKE '%bit%' THEN 'BIT'::"PaymentMethod"
  WHEN LOWER("method") LIKE '%paypal%' THEN 'PAYPAL'::"PaymentMethod"
  WHEN LOWER("method") LIKE '%stripe%' THEN 'STRIPE'::"PaymentMethod"
  ELSE 'OTHER'::"PaymentMethod"
END;

-- Step 4: Drop old method column and rename new one
ALTER TABLE "payments" DROP COLUMN "method";
ALTER TABLE "payments" RENAME COLUMN "method_new" TO "method";
ALTER TABLE "payments" ALTER COLUMN "method" SET NOT NULL;

-- Step 5: Make currency and payment_date NOT NULL after setting defaults
ALTER TABLE "payments" ALTER COLUMN "currency" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "payment_date" SET NOT NULL;

-- Step 6: Add foreign key constraints for user relations
ALTER TABLE "payments" ADD CONSTRAINT "payments_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes on payments
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");
CREATE INDEX "payments_method_idx" ON "payments"("method");
CREATE INDEX "payments_processed_by_idx" ON "payments"("processed_by");
CREATE INDEX "payments_status_payment_date_idx" ON "payments"("status", "payment_date");

-- CreateTable payment_plans
CREATE TABLE "payment_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "total_amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'ILS',
    "number_of_installments" INTEGER NOT NULL,
    "frequency_days" INTEGER NOT NULL,
    "status" "PaymentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable payment_installments
CREATE TABLE "payment_installments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_plan_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paid_date" TIMESTAMP(3),
    "paid_amount_cents" INTEGER,
    "payment_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_plans_order_id_idx" ON "payment_plans"("order_id");
CREATE INDEX "payment_plans_status_idx" ON "payment_plans"("status");
CREATE INDEX "payment_plans_start_date_idx" ON "payment_plans"("start_date");

-- CreateIndex
CREATE UNIQUE INDEX "payment_installments_payment_id_key" ON "payment_installments"("payment_id");
CREATE INDEX "payment_installments_payment_plan_id_idx" ON "payment_installments"("payment_plan_id");
CREATE INDEX "payment_installments_due_date_idx" ON "payment_installments"("due_date");
CREATE INDEX "payment_installments_status_idx" ON "payment_installments"("status");
CREATE INDEX "payment_installments_installment_number_idx" ON "payment_installments"("installment_number");

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
