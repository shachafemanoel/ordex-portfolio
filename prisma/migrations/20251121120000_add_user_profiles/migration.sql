-- Add dedicated profiles per role (Installer, Sales, Ops)

-- InstallerProfile
CREATE TABLE IF NOT EXISTS "installer_profiles" (
    "id" UUID NOT NULL,
    "current_assignments" INTEGER NOT NULL DEFAULT 0,
    "completed_installs" INTEGER NOT NULL DEFAULT 0,
    "regions" JSONB,
    "skills" JSONB,
    "avg_sla_minutes" INTEGER,
    "vehicle_type" TEXT,
    "calendar_sync" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "installer_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "installer_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- SalesProfile
CREATE TABLE IF NOT EXISTS "sales_profiles" (
    "id" UUID NOT NULL,
    "quota_monthly" INTEGER,
    "achieved_month" INTEGER,
    "pipeline_count" INTEGER,
    "conversion_rate" DECIMAL(10,4),
    "regions" JSONB,
    "commission_plan" JSONB,
    CONSTRAINT "sales_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sales_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- OpsProfile
CREATE TABLE IF NOT EXISTS "ops_profiles" (
    "id" UUID NOT NULL,
    "inventory_scope" JSONB,
    "po_approval_limit" INTEGER,
    "sla_breach_alerts" BOOLEAN NOT NULL DEFAULT true,
    "teams_managed" JSONB,
    "dashboards" JSONB,
    CONSTRAINT "ops_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ops_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Helpful index on users.role for quicker profile routing
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
