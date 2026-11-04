-- Address normalization + work calendar scaffolding

-- Address validation enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AddressValidationStatus') THEN
    CREATE TYPE "AddressValidationStatus" AS ENUM ('VALID', 'SUSPICIOUS', 'MISSING');
  END IF;
END;
$$;

-- Installation time slot enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstallationTimeSlot') THEN
    CREATE TYPE "InstallationTimeSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'CUSTOM');
  END IF;
END;
$$;

-- Installation task status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstallationTaskStatus') THEN
    CREATE TYPE "InstallationTaskStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED');
  END IF;
END;
$$;

-- New structured address fields on orders
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "address_raw" TEXT,
  ADD COLUMN IF NOT EXISTS "street" VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "house_number" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "floor" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "apartment" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "address_validation_status" "AddressValidationStatus",
  ADD COLUMN IF NOT EXISTS "address_validation_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- Installation task table
CREATE TABLE IF NOT EXISTS "installation_tasks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "scheduled_date" TIMESTAMPTZ NOT NULL,
  "time_slot" "InstallationTimeSlot",
  "duration_minutes" INTEGER,
  "technician_id" UUID,
  "status" "InstallationTaskStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "installation_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "installation_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "installation_tasks_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "installation_tasks_order_id_idx" ON "installation_tasks"("order_id");
CREATE INDEX IF NOT EXISTS "installation_tasks_scheduled_date_idx" ON "installation_tasks"("scheduled_date");
CREATE INDEX IF NOT EXISTS "installation_tasks_technician_id_idx" ON "installation_tasks"("technician_id");
CREATE INDEX IF NOT EXISTS "installation_tasks_status_idx" ON "installation_tasks"("status");

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_installation_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER installation_tasks_updated_at
  BEFORE UPDATE ON "installation_tasks"
  FOR EACH ROW
  EXECUTE FUNCTION update_installation_tasks_updated_at();
