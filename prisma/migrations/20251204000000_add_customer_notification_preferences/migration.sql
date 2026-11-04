-- Add CustomerNotificationPreferences table for managing customer notification settings
-- This table was referenced in app/api/notifications/preferences/route.ts but was missing from schema

-- Note: Using NotificationChannel enum which already exists in the database
-- (SMS, WHATSAPP, EMAIL, DISABLED)

CREATE TYPE "NotificationMethod" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL', 'DISABLED');

CREATE TABLE IF NOT EXISTS "customer_notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_phone" VARCHAR(64) NOT NULL,
    "preferred_method" "NotificationMethod" NOT NULL DEFAULT 'SMS',
    "is_opted_out" BOOLEAN NOT NULL DEFAULT false,
    "working_hours_only" BOOLEAN NOT NULL DEFAULT true,
    "working_hours_start" INTEGER NOT NULL DEFAULT 9,
    "working_hours_end" INTEGER NOT NULL DEFAULT 18,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Jerusalem',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- Create unique index on customer_phone for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS "customer_notification_preferences_customer_phone_key"
    ON "customer_notification_preferences"("customer_phone");

-- Create index for querying by opt-out status
CREATE INDEX IF NOT EXISTS "customer_notification_preferences_is_opted_out_idx"
    ON "customer_notification_preferences"("is_opted_out");

-- Create index for timezone-based queries
CREATE INDEX IF NOT EXISTS "customer_notification_preferences_timezone_idx"
    ON "customer_notification_preferences"("timezone");

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_customer_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_notification_preferences_updated_at
    BEFORE UPDATE ON "customer_notification_preferences"
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_notification_preferences_updated_at();
