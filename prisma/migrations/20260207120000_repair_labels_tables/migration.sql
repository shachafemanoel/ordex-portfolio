-- 1. Fix OrderStatus Enum (Idempotent)
DO $$
BEGIN
  -- Check and add CANCELLED
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'CANCELLED'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrderStatus' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE "public"."OrderStatus" ADD VALUE 'CANCELLED';
  END IF;

  -- Check and add READY_FOR_INSTALL
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'READY_FOR_INSTALL'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrderStatus' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE "public"."OrderStatus" ADD VALUE 'READY_FOR_INSTALL';
  END IF;
END $$;

-- 2. Create Label table if not exists
CREATE TABLE IF NOT EXISTS "public"."labels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT,
    "stage" "public"."OrderStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- 3. Create unique index on labels(name)
CREATE UNIQUE INDEX IF NOT EXISTS "labels_name_key" ON "public"."labels"("name");

-- 4. Create _OrderLabels join table if not exists
CREATE TABLE IF NOT EXISTS "public"."_OrderLabels" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- 5. Create indexes for _OrderLabels
CREATE UNIQUE INDEX IF NOT EXISTS "_OrderLabels_AB_unique" ON "public"."_OrderLabels"("A", "B");
CREATE INDEX IF NOT EXISTS "_OrderLabels_B_index" ON "public"."_OrderLabels"("B");

-- 6. Add Foreign Keys safely
DO $$
BEGIN
    -- FK for A (Label)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_OrderLabels_A_fkey') THEN
        ALTER TABLE "public"."_OrderLabels" ADD CONSTRAINT "_OrderLabels_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- FK for B (Order)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_OrderLabels_B_fkey') THEN
        ALTER TABLE "public"."_OrderLabels" ADD CONSTRAINT "_OrderLabels_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
