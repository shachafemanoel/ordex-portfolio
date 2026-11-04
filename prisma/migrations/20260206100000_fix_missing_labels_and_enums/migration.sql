-- Fix Enum OrderStatus
ALTER TYPE "public"."OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "public"."OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_INSTALL';

-- Create Table labels
CREATE TABLE IF NOT EXISTS "public"."labels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT,
    "stage" "public"."OrderStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- Create Unique Index on labels(name)
CREATE UNIQUE INDEX IF NOT EXISTS "labels_name_key" ON "public"."labels"("name");

-- Create Implicit Many-to-Many Table _OrderLabels
CREATE TABLE IF NOT EXISTS "public"."_OrderLabels" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- Create Unique Index on _OrderLabels(A, B)
CREATE UNIQUE INDEX IF NOT EXISTS "_OrderLabels_AB_unique" ON "public"."_OrderLabels"("A", "B");

-- Create Index on _OrderLabels(B)
CREATE INDEX IF NOT EXISTS "_OrderLabels_B_index" ON "public"."_OrderLabels"("B");

-- Add Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_OrderLabels_A_fkey') THEN
        ALTER TABLE "public"."_OrderLabels" ADD CONSTRAINT "_OrderLabels_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_OrderLabels_B_fkey') THEN
        ALTER TABLE "public"."_OrderLabels" ADD CONSTRAINT "_OrderLabels_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
