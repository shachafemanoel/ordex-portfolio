-- CreateEnum
CREATE TYPE "InstallationSlotStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "installation_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "technician_id" UUID,
    "date" TIMESTAMPTZ NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "city" VARCHAR(120),
    "address" VARCHAR(255),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "status" "InstallationSlotStatus" NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "installation_slots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installation_slots_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "installation_slots_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "installation_slots_date_idx" ON "installation_slots"("date");
CREATE INDEX "installation_slots_technician_id_idx" ON "installation_slots"("technician_id");
CREATE INDEX "installation_slots_order_id_idx" ON "installation_slots"("order_id");
CREATE INDEX "installation_slots_status_idx" ON "installation_slots"("status");

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION update_installation_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER installation_slots_updated_at
BEFORE UPDATE ON "installation_slots"
FOR EACH ROW EXECUTE FUNCTION update_installation_slots_updated_at();
