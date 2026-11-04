-- Fix schema drift: Add missing column manually
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "duration_override_minutes" INTEGER;
