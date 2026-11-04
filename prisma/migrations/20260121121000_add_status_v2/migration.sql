-- AlterTable
ALTER TABLE "orders" ADD COLUMN "status_v2" TEXT,
ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "on_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inventory_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "completion_type" TEXT,
ADD COLUMN "status_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_outbox" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "order_status_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_timestamp_idx" ON "order_status_history"("timestamp");

-- CreateIndex
CREATE INDEX "order_status_outbox_processed_idx" ON "order_status_outbox"("processed");

-- CreateIndex
CREATE INDEX "order_status_outbox_created_at_idx" ON "order_status_outbox"("created_at");

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_outbox" ADD CONSTRAINT "order_status_outbox_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
