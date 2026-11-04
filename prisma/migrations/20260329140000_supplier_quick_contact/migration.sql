-- AlterTable (idempotent: DB may already have column from manual / partial apply)
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "quick_contact" BOOLEAN NOT NULL DEFAULT false;
