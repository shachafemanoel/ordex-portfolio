-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "duration_override_minutes" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "api_token" TEXT;

-- CreateTable
CREATE TABLE "webhook_event_logs" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_api_token_key" ON "users"("api_token");
