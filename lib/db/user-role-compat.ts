import { Client, type ClientConfig } from 'pg';
import { withSslModeRequire } from './connection-url';

const ADVISORY_LOCK_ID = 88421173;

export const CANONICAL_USER_ROLES = [
  'ADMIN',
  'SALES',
  'PURCHASING',
  'INSTALLER',
  'OPERATIONS',
  'VIEWER',
] as const;

export const LEGACY_TO_CANONICAL_USER_ROLES = {
  MANAGER: 'ADMIN',
  OPERATIONS_WORKER: 'OPERATIONS',
} as const;

type CanonicalUserRole = (typeof CANONICAL_USER_ROLES)[number];
type LegacyUserRole = keyof typeof LEGACY_TO_CANONICAL_USER_ROLES;

export interface UserRoleCompatibilityResult {
  checked: boolean;
  repaired: boolean;
  currentValues: string[];
  legacyValues: string[];
  message: string;
}

let compatibilityPromise: Promise<UserRoleCompatibilityResult> | null = null;

function getClientConfig(): ClientConfig | null {
  const connectionString = withSslModeRequire(process.env.DATABASE_URL);

  if (!connectionString) {
    return null;
  }

  const useSsl =
    !connectionString.includes('localhost') &&
    !connectionString.includes('127.0.0.1');

  return {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}

async function getCurrentEnumValues(client: Client): Promise<string[]> {
  const result = await client.query<{ value: string }>(`
    SELECT e.enumlabel AS value
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole'
    ORDER BY e.enumsortorder
  `);

  return result.rows.map((row) => row.value);
}

function isLegacyRole(role: string): role is LegacyUserRole {
  return Object.prototype.hasOwnProperty.call(LEGACY_TO_CANONICAL_USER_ROLES, role);
}

async function ensureSchemaObjectsExist(client: Client): Promise<boolean> {
  const result = await client.query<{ has_users: boolean; has_type: boolean }>(`
    SELECT
      to_regclass('public.users') IS NOT NULL AS has_users,
      to_regtype('"UserRole"') IS NOT NULL AS has_type
  `);

  const row = result.rows[0];
  return Boolean(row?.has_users && row?.has_type);
}

async function repairUserRoleEnum(client: Client): Promise<void> {
  await client.query('BEGIN');

  try {
    await client.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
    await client.query(`ALTER TYPE "UserRole" RENAME TO "UserRole_legacy"`);
    await client.query(`
      CREATE TYPE "UserRole" AS ENUM (
        'ADMIN',
        'SALES',
        'PURCHASING',
        'INSTALLER',
        'OPERATIONS',
        'VIEWER'
      )
    `);
    await client.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role" TYPE "UserRole"
      USING (
        CASE "role"::text
          WHEN 'MANAGER' THEN 'ADMIN'
          WHEN 'OPERATIONS_WORKER' THEN 'OPERATIONS'
          ELSE "role"::text
        END
      )::"UserRole"
    `);
    await client.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'SALES'::"UserRole"`);
    await client.query(`DROP TYPE "UserRole_legacy"`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runCompatibilityCheck(): Promise<UserRoleCompatibilityResult> {
  const config = getClientConfig();
  if (!config) {
    return {
      checked: false,
      repaired: false,
      currentValues: [],
      legacyValues: [],
      message: 'DATABASE_URL is not configured',
    };
  }

  const client = new Client(config);
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID]);

    const schemaReady = await ensureSchemaObjectsExist(client);
    if (!schemaReady) {
      return {
        checked: false,
        repaired: false,
        currentValues: [],
        legacyValues: [],
        message: 'users table or UserRole enum does not exist yet',
      };
    }

    const currentValues = await getCurrentEnumValues(client);
    const legacyValues = currentValues.filter(isLegacyRole);
    const missingCanonicalValues = CANONICAL_USER_ROLES.filter(
      (role) => !currentValues.includes(role)
    );

    if (legacyValues.length === 0 && missingCanonicalValues.length === 0) {
      return {
        checked: true,
        repaired: false,
        currentValues,
        legacyValues: [],
        message: 'UserRole enum is already compatible',
      };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('UserRole schema drift requires a reviewed release migration.');
    }
    await repairUserRoleEnum(client);
    const repairedValues = await getCurrentEnumValues(client);

    return {
      checked: true,
      repaired: true,
      currentValues: repairedValues,
      legacyValues,
      message: `Repaired UserRole enum (${legacyValues.join(', ') || 'schema drift'})`,
    };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]).catch(() => {});
    await client.end().catch(() => {});
  }
}

export async function ensureUserRoleEnumCompatibility(): Promise<UserRoleCompatibilityResult> {
  if (!compatibilityPromise) {
    compatibilityPromise = runCompatibilityCheck().catch((error) => {
      compatibilityPromise = null;
      throw error;
    });
  }

  return compatibilityPromise;
}

export function mapLegacyUserRole(role: string | null | undefined): CanonicalUserRole {
  if (!role) {
    return 'OPERATIONS';
  }

  const normalizedRole = role.toUpperCase();
  if (normalizedRole in LEGACY_TO_CANONICAL_USER_ROLES) {
    return LEGACY_TO_CANONICAL_USER_ROLES[normalizedRole as LegacyUserRole];
  }

  if (CANONICAL_USER_ROLES.includes(normalizedRole as CanonicalUserRole)) {
    return normalizedRole as CanonicalUserRole;
  }

  return 'OPERATIONS';
}
