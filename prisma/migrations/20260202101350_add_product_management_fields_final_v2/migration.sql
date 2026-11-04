-- CreateEnum
CREATE TYPE "SerialNumberType" AS ENUM ('NONE', 'AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('PENDING', 'ALLOCATED', 'OUT_OF_STOCK', 'ON_ORDER');

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_fkey";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "allocation_status" "AllocationStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "product_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "inventory_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "procurement_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serial_number_type" "SerialNumberType" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "receiving_items" ALTER COLUMN "order_item_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "order_items_allocation_status_idx" ON "order_items"("allocation_status");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
