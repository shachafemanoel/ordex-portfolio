/*
  Warnings:

  - You are about to drop the `product_bundle_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('COUPON', 'AUTOMATIC', 'BUNDLE_DISCOUNT', 'VOLUME', 'SEASONAL');

-- CreateEnum
CREATE TYPE "DiscountValueType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE');

-- DropForeignKey
ALTER TABLE "product_bundle_items" DROP CONSTRAINT "product_bundle_items_child_id_fkey";

-- DropForeignKey
ALTER TABLE "product_bundle_items" DROP CONSTRAINT "product_bundle_items_parent_id_fkey";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "bundle_item_id" UUID,
ADD COLUMN     "from_bundle_id" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discount_code" TEXT,
ADD COLUMN     "discount_id" UUID;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_bundle" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "product_bundle_items";

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "override_price_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "DiscountType" NOT NULL,
    "value_type" "DiscountValueType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "min_order_cents" INTEGER,
    "max_discount_cents" INTEGER,
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "usage_limit_per_user" INTEGER,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "applies_to_all" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_products" (
    "id" UUID NOT NULL,
    "discount_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_usages" (
    "id" UUID NOT NULL,
    "discount_id" UUID NOT NULL,
    "order_id" UUID,
    "customer_id" UUID,
    "amount_cents" INTEGER NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bundle_items_bundle_id_idx" ON "bundle_items"("bundle_id");

-- CreateIndex
CREATE INDEX "bundle_items_product_id_idx" ON "bundle_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_items_bundle_id_product_id_key" ON "bundle_items"("bundle_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "discounts_code_key" ON "discounts"("code");

-- CreateIndex
CREATE INDEX "discounts_code_idx" ON "discounts"("code");

-- CreateIndex
CREATE INDEX "discounts_is_active_idx" ON "discounts"("is_active");

-- CreateIndex
CREATE INDEX "discounts_starts_at_expires_at_idx" ON "discounts"("starts_at", "expires_at");

-- CreateIndex
CREATE INDEX "discounts_type_idx" ON "discounts"("type");

-- CreateIndex
CREATE INDEX "discount_products_discount_id_idx" ON "discount_products"("discount_id");

-- CreateIndex
CREATE INDEX "discount_products_product_id_idx" ON "discount_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_products_discount_id_product_id_key" ON "discount_products"("discount_id", "product_id");

-- CreateIndex
CREATE INDEX "discount_usages_discount_id_idx" ON "discount_usages"("discount_id");

-- CreateIndex
CREATE INDEX "discount_usages_order_id_idx" ON "discount_usages"("order_id");

-- CreateIndex
CREATE INDEX "discount_usages_customer_id_idx" ON "discount_usages"("customer_id");

-- CreateIndex
CREATE INDEX "discount_usages_used_at_idx" ON "discount_usages"("used_at");

-- CreateIndex
CREATE INDEX "orders_discount_id_idx" ON "orders"("discount_id");

-- CreateIndex
CREATE INDEX "products_is_bundle_idx" ON "products"("is_bundle");

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_products" ADD CONSTRAINT "discount_products_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
