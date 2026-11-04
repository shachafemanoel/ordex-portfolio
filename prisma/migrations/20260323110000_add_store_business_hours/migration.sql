ALTER TABLE "store_configurations"
ADD COLUMN IF NOT EXISTS "business_day_start_time" VARCHAR(5) NOT NULL DEFAULT '09:00';

ALTER TABLE "store_configurations"
ADD COLUMN IF NOT EXISTS "business_day_end_time" VARCHAR(5) NOT NULL DEFAULT '18:00';
