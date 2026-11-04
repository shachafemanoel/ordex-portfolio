-- Add missing free‑text notes column for order line items
-- Safe to run multiple times thanks to IF NOT EXISTS
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "remarks" TEXT;

