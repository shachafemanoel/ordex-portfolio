-- Migration: Consolidate roles to two-role system (ADMIN + OPERATIONS)
-- All non-ADMIN users are converted to OPERATIONS (general worker)

UPDATE "users"
SET "role" = 'OPERATIONS'
WHERE "role" IN ('SALES', 'PURCHASING', 'INSTALLER', 'VIEWER');

-- Update default role column (handled via schema change to @default(OPERATIONS))
