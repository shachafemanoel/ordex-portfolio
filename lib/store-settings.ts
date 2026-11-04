import { isTenantRuntime, requireTenantId } from '@/lib/tenancy/context';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  DEFAULT_BUSINESS_DAY_END_TIME,
  DEFAULT_BUSINESS_DAY_START_TIME,
} from '@/lib/store-business-hours';
import {
  storeSettingsSchema,
  storeSettingsSnapshotSchema,
  type StoreSettingsDto,
  type StoreSettingsSnapshot,
} from '@/lib/store-settings-schema';

import {
  buildGeocodeV6ForwardPath,
  fetchMapboxJson,
  getMapboxAccessToken,
  ISRAEL_BBOX,
} from '@/lib/mapbox/server';

async function configurationId(): Promise<string> {
  if (!isTenantRuntime()) return 'default';
  const id = await requireTenantId();
  return id === 'legacy' ? 'default' : id.replaceAll('-', '');
}
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let ensureStoreConfigurationPromise: Promise<void> | null = null;

type StoreConfigurationRecord = {
  storeName: string;
  storeEmail: string | null;
  storePhone: string | null;
  storeAddressLine: string | null;
  storeCity: string | null;
  defaultCurrency: string;
  timezone: string;
  language: string;
  taxRatePercent: number;
  lowStockThreshold: number;
  autoPurchaseOrder: boolean;
  orderNumberPrefix: string;
  businessDayStartTime: string;
  businessDayEndTime: string;
  useStoreAddressAsWarehouse: boolean;
  warehouseAddressLine: string | null;
  warehouseCity: string | null;
  warehouseLat: number | null;
  warehouseLng: number | null;
  updatedAt: Date | string | null;
};

function toFiniteOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_REGEX.test(value) ? value : null;
}

function normalizeUpdatedAt(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getEnvDefaults(): StoreSettingsDto {
  const settingsEnv: Record<string, string | undefined> = isTenantRuntime() ? {} : process.env;
  const hasWarehouseAddress = Boolean(
    (settingsEnv.STORE_WAREHOUSE_ADDRESS_LINE ?? '').trim() ||
    (settingsEnv.STORE_WAREHOUSE_CITY ?? '').trim()
  );

  const parsed = storeSettingsSchema.parse({
    storeName: settingsEnv.STORE_NAME ?? 'Ordex Store',
    storeEmail: settingsEnv.STORE_EMAIL ?? settingsEnv.COMPANY_EMAIL ?? '',
    storePhone: settingsEnv.STORE_PHONE ?? settingsEnv.COMPANY_PHONE ?? '',
    storeAddressLine: settingsEnv.STORE_ADDRESS_LINE ?? settingsEnv.COMPANY_ADDRESS_LINE ?? '',
    storeCity: settingsEnv.STORE_CITY ?? settingsEnv.COMPANY_CITY ?? '',
    defaultCurrency: settingsEnv.DEFAULT_CURRENCY ?? 'ILS',
    timezone: settingsEnv.STORE_TIMEZONE ?? settingsEnv.TZ ?? 'Asia/Jerusalem',
    language: settingsEnv.STORE_LANGUAGE ?? 'he',
    taxRatePercent: Number(settingsEnv.TAX_RATE_PERCENT ?? 0),
    lowStockThreshold: Number(settingsEnv.LOW_STOCK_THRESHOLD ?? 0),
    autoPurchaseOrder: settingsEnv.AUTO_PURCHASE_ORDER !== 'false',
    orderNumberPrefix: settingsEnv.ORDER_NUMBER_PREFIX ?? 'ORD-',
    businessDayStartTime: settingsEnv.STORE_BUSINESS_DAY_START ?? DEFAULT_BUSINESS_DAY_START_TIME,
    businessDayEndTime: settingsEnv.STORE_BUSINESS_DAY_END ?? DEFAULT_BUSINESS_DAY_END_TIME,
    useStoreAddressAsWarehouse:
      settingsEnv.USE_STORE_ADDRESS_AS_WAREHOUSE != null
        ? settingsEnv.USE_STORE_ADDRESS_AS_WAREHOUSE !== 'false'
        : !hasWarehouseAddress,
    warehouseAddressLine: settingsEnv.STORE_WAREHOUSE_ADDRESS_LINE ?? '',
    warehouseCity: settingsEnv.STORE_WAREHOUSE_CITY ?? '',
    warehouseLat: toFiniteOrNull(settingsEnv.STORE_WAREHOUSE_LAT ?? settingsEnv.STORE_LAT ?? ''),
    warehouseLng: toFiniteOrNull(settingsEnv.STORE_WAREHOUSE_LNG ?? settingsEnv.STORE_LNG ?? ''),
  });

  return parsed;
}

async function ensureStoreConfigurationTable(): Promise<void> {
  // The tenant runtime role cannot run DDL; release migrations own this table there.
  if (isTenantRuntime()) return;
  if (ensureStoreConfigurationPromise) {
    return ensureStoreConfigurationPromise;
  }

  ensureStoreConfigurationPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "store_configurations" (
        "id" VARCHAR(32) NOT NULL DEFAULT 'default',
        "store_name" VARCHAR(120) NOT NULL DEFAULT 'Ordex Store',
        "store_email" VARCHAR(320),
        "store_phone" VARCHAR(64),
        "store_address_line" TEXT,
        "store_city" VARCHAR(120),
        "default_currency" CHAR(3) NOT NULL DEFAULT 'ILS',
        "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Jerusalem',
        "language" VARCHAR(10) NOT NULL DEFAULT 'he',
        "tax_rate_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
        "auto_purchase_order" BOOLEAN NOT NULL DEFAULT true,
        "order_number_prefix" VARCHAR(20) NOT NULL DEFAULT 'ORD-',
        "business_day_start_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
        "business_day_end_time" VARCHAR(5) NOT NULL DEFAULT '18:00',
        "use_store_address_as_warehouse" BOOLEAN NOT NULL DEFAULT true,
        "warehouse_address_line" TEXT,
        "warehouse_city" VARCHAR(120),
        "warehouse_lat" DOUBLE PRECISION,
        "warehouse_lng" DOUBLE PRECISION,
        "updated_by_id" UUID,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "store_configurations_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "store_configurations_updated_by_id_fkey"
          FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
          ON DELETE SET NULL
          ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_store_configurations_updated_at"
      ON "store_configurations"("updated_at");
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "store_configurations"
      ADD COLUMN IF NOT EXISTS "business_day_start_time" VARCHAR(5) NOT NULL DEFAULT '09:00';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "store_configurations"
      ADD COLUMN IF NOT EXISTS "business_day_end_time" VARCHAR(5) NOT NULL DEFAULT '18:00';
    `);
  })().catch((error) => {
    ensureStoreConfigurationPromise = null;
    throw error;
  });

  return ensureStoreConfigurationPromise;
}

function isStoreConfigurationSchemaError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2021' && error.code !== 'P2022') return false;
  const message = error.message.toLowerCase();
  const meta = error.meta as Record<string, unknown> | undefined;
  const table = typeof meta?.table === 'string' ? meta.table.toLowerCase() : '';
  return message.includes('store_configurations') || table.includes('store_configurations');
}

function mergeStoreSettings(
  defaults: StoreSettingsDto,
  record: StoreConfigurationRecord | null
): StoreSettingsDto {
  return storeSettingsSchema.parse({
    storeName: record?.storeName ?? defaults.storeName,
    storeEmail: record?.storeEmail ?? defaults.storeEmail,
    storePhone: record?.storePhone ?? defaults.storePhone,
    storeAddressLine: record?.storeAddressLine ?? defaults.storeAddressLine,
    storeCity: record?.storeCity ?? defaults.storeCity,
    defaultCurrency: record?.defaultCurrency ?? defaults.defaultCurrency,
    timezone: record?.timezone ?? defaults.timezone,
    language: record?.language ?? defaults.language,
    taxRatePercent: record?.taxRatePercent ?? defaults.taxRatePercent,
    lowStockThreshold: record?.lowStockThreshold ?? defaults.lowStockThreshold,
    autoPurchaseOrder: record?.autoPurchaseOrder ?? defaults.autoPurchaseOrder,
    orderNumberPrefix: record?.orderNumberPrefix ?? defaults.orderNumberPrefix,
    businessDayStartTime: record?.businessDayStartTime ?? defaults.businessDayStartTime,
    businessDayEndTime: record?.businessDayEndTime ?? defaults.businessDayEndTime,
    useStoreAddressAsWarehouse:
      record?.useStoreAddressAsWarehouse ?? defaults.useStoreAddressAsWarehouse,
    warehouseAddressLine: record?.warehouseAddressLine ?? defaults.warehouseAddressLine,
    warehouseCity: record?.warehouseCity ?? defaults.warehouseCity,
    warehouseLat: record?.warehouseLat ?? defaults.warehouseLat,
    warehouseLng: record?.warehouseLng ?? defaults.warehouseLng,
  });
}

async function geocodeWarehouseLocation(addressLine: string, city: string) {
  const label = [addressLine.trim(), city.trim(), 'ישראל'].filter(Boolean).join(', ');
  if (!label || !getMapboxAccessToken()) {
    return null;
  }

  const path = buildGeocodeV6ForwardPath({
    q: label,
    autocomplete: false,
    limit: 1,
    country: 'IL',
    bbox: ISRAEL_BBOX,
  });
  const payload = await fetchMapboxJson<{
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
  }>(path);
  const coordinates = payload?.features?.[0]?.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  return {
    lng: coordinates[0],
    lat: coordinates[1],
  };
}

async function readStoreConfiguration(): Promise<StoreConfigurationRecord | null> {
  const rows = await prisma.$queryRaw<StoreConfigurationRecord[]>(Prisma.sql`
    SELECT
      "store_name" AS "storeName",
      "store_email" AS "storeEmail",
      "store_phone" AS "storePhone",
      "store_address_line" AS "storeAddressLine",
      "store_city" AS "storeCity",
      "default_currency" AS "defaultCurrency",
      "timezone" AS "timezone",
      "language" AS "language",
      "tax_rate_percent" AS "taxRatePercent",
      "low_stock_threshold" AS "lowStockThreshold",
      "auto_purchase_order" AS "autoPurchaseOrder",
      "order_number_prefix" AS "orderNumberPrefix",
      "business_day_start_time" AS "businessDayStartTime",
      "business_day_end_time" AS "businessDayEndTime",
      "use_store_address_as_warehouse" AS "useStoreAddressAsWarehouse",
      "warehouse_address_line" AS "warehouseAddressLine",
      "warehouse_city" AS "warehouseCity",
      "warehouse_lat" AS "warehouseLat",
      "warehouse_lng" AS "warehouseLng",
      "updated_at" AS "updatedAt"
    FROM "store_configurations"
    WHERE "id" = ${await configurationId()}
    LIMIT 1
  `);

  return rows[0] ?? null;
}

async function upsertStoreConfiguration(input: {
  storeName: string;
  storeEmail: string | null;
  storePhone: string | null;
  storeAddressLine: string | null;
  storeCity: string | null;
  defaultCurrency: string;
  timezone: string;
  language: string;
  taxRatePercent: number;
  lowStockThreshold: number;
  autoPurchaseOrder: boolean;
  orderNumberPrefix: string;
  businessDayStartTime: string;
  businessDayEndTime: string;
  useStoreAddressAsWarehouse: boolean;
  warehouseAddressLine: string | null;
  warehouseCity: string | null;
  warehouseLat: number | null;
  warehouseLng: number | null;
  updatedById: string | null;
}): Promise<StoreConfigurationRecord> {
  const rows = await prisma.$queryRaw<StoreConfigurationRecord[]>(Prisma.sql`
    INSERT INTO "store_configurations" (
      "id",
      "store_name",
      "store_email",
      "store_phone",
      "store_address_line",
      "store_city",
      "default_currency",
      "timezone",
      "language",
      "tax_rate_percent",
      "low_stock_threshold",
      "auto_purchase_order",
      "order_number_prefix",
      "business_day_start_time",
      "business_day_end_time",
      "use_store_address_as_warehouse",
      "warehouse_address_line",
      "warehouse_city",
      "warehouse_lat",
      "warehouse_lng",
      "updated_by_id"
    )
    VALUES (
      ${await configurationId()},
      ${input.storeName},
      ${input.storeEmail},
      ${input.storePhone},
      ${input.storeAddressLine},
      ${input.storeCity},
      ${input.defaultCurrency},
      ${input.timezone},
      ${input.language},
      ${input.taxRatePercent},
      ${input.lowStockThreshold},
      ${input.autoPurchaseOrder},
      ${input.orderNumberPrefix},
      ${input.businessDayStartTime},
      ${input.businessDayEndTime},
      ${input.useStoreAddressAsWarehouse},
      ${input.warehouseAddressLine},
      ${input.warehouseCity},
      ${input.warehouseLat},
      ${input.warehouseLng},
      ${input.updatedById}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "store_name" = EXCLUDED."store_name",
      "store_email" = EXCLUDED."store_email",
      "store_phone" = EXCLUDED."store_phone",
      "store_address_line" = EXCLUDED."store_address_line",
      "store_city" = EXCLUDED."store_city",
      "default_currency" = EXCLUDED."default_currency",
      "timezone" = EXCLUDED."timezone",
      "language" = EXCLUDED."language",
      "tax_rate_percent" = EXCLUDED."tax_rate_percent",
      "low_stock_threshold" = EXCLUDED."low_stock_threshold",
      "auto_purchase_order" = EXCLUDED."auto_purchase_order",
      "order_number_prefix" = EXCLUDED."order_number_prefix",
      "business_day_start_time" = EXCLUDED."business_day_start_time",
      "business_day_end_time" = EXCLUDED."business_day_end_time",
      "use_store_address_as_warehouse" = EXCLUDED."use_store_address_as_warehouse",
      "warehouse_address_line" = EXCLUDED."warehouse_address_line",
      "warehouse_city" = EXCLUDED."warehouse_city",
      "warehouse_lat" = EXCLUDED."warehouse_lat",
      "warehouse_lng" = EXCLUDED."warehouse_lng",
      "updated_by_id" = EXCLUDED."updated_by_id",
      "updated_at" = CURRENT_TIMESTAMP
    RETURNING
      "store_name" AS "storeName",
      "store_email" AS "storeEmail",
      "store_phone" AS "storePhone",
      "store_address_line" AS "storeAddressLine",
      "store_city" AS "storeCity",
      "default_currency" AS "defaultCurrency",
      "timezone" AS "timezone",
      "language" AS "language",
      "tax_rate_percent" AS "taxRatePercent",
      "low_stock_threshold" AS "lowStockThreshold",
      "auto_purchase_order" AS "autoPurchaseOrder",
      "order_number_prefix" AS "orderNumberPrefix",
      "business_day_start_time" AS "businessDayStartTime",
      "business_day_end_time" AS "businessDayEndTime",
      "use_store_address_as_warehouse" AS "useStoreAddressAsWarehouse",
      "warehouse_address_line" AS "warehouseAddressLine",
      "warehouse_city" AS "warehouseCity",
      "warehouse_lat" AS "warehouseLat",
      "warehouse_lng" AS "warehouseLng",
      "updated_at" AS "updatedAt"
  `);

  if (!rows[0]) {
    throw new Error('Failed to persist store configuration');
  }

  return rows[0];
}

export async function getEditableStoreSettings(): Promise<StoreSettingsSnapshot> {
  const defaults = getEnvDefaults();

  try {
    await ensureStoreConfigurationTable();

    const record = await readStoreConfiguration();
    const merged = mergeStoreSettings(defaults, record);

    return storeSettingsSnapshotSchema.parse({
      ...merged,
      updatedAt: normalizeUpdatedAt(record?.updatedAt),
      source: record ? 'database' : 'env',
    });
  } catch (error) {
    if (isStoreConfigurationSchemaError(error)) {
      return storeSettingsSnapshotSchema.parse({
        ...defaults,
        updatedAt: null,
        source: 'env',
      });
    }

    throw error;
  }
}

export async function getStoreSettings(): Promise<StoreSettingsDto> {
  const snapshot = await getEditableStoreSettings();
  return storeSettingsSchema.parse(snapshot);
}

export async function updateStoreSettings(
  input: StoreSettingsDto,
  updatedById?: string | null
): Promise<StoreSettingsSnapshot> {
  await ensureStoreConfigurationTable();

  const parsed = storeSettingsSchema.parse({
    ...input,
    taxRatePercent: Number(input.taxRatePercent),
    lowStockThreshold: Math.max(0, Math.round(Number(input.lowStockThreshold))),
    warehouseLat: toFiniteOrNull(input.warehouseLat),
    warehouseLng: toFiniteOrNull(input.warehouseLng),
  });

  const shouldUseStoreAddress = parsed.useStoreAddressAsWarehouse;
  const geocodedLocation =
    !shouldUseStoreAddress && (parsed.warehouseAddressLine.trim() || parsed.warehouseCity.trim())
      ? await geocodeWarehouseLocation(parsed.warehouseAddressLine, parsed.warehouseCity)
      : null;

  const record = await upsertStoreConfiguration({
    storeName: parsed.storeName.trim(),
    storeEmail: toNullableString(parsed.storeEmail),
    storePhone: toNullableString(parsed.storePhone),
    storeAddressLine: toNullableString(parsed.storeAddressLine),
    storeCity: toNullableString(parsed.storeCity),
    defaultCurrency: parsed.defaultCurrency,
    timezone: parsed.timezone.trim(),
    language: parsed.language,
    taxRatePercent: parsed.taxRatePercent,
    lowStockThreshold: parsed.lowStockThreshold,
    autoPurchaseOrder: parsed.autoPurchaseOrder,
    orderNumberPrefix: parsed.orderNumberPrefix.trim(),
    businessDayStartTime: parsed.businessDayStartTime,
    businessDayEndTime: parsed.businessDayEndTime,
    useStoreAddressAsWarehouse: shouldUseStoreAddress,
    warehouseAddressLine: toNullableString(parsed.warehouseAddressLine),
    warehouseCity: toNullableString(parsed.warehouseCity),
    warehouseLat: shouldUseStoreAddress
      ? null
      : (geocodedLocation?.lat ?? parsed.warehouseLat ?? null),
    warehouseLng: shouldUseStoreAddress
      ? null
      : (geocodedLocation?.lng ?? parsed.warehouseLng ?? null),
    updatedById: toNullableUuid(updatedById),
  });

  return storeSettingsSnapshotSchema.parse({
    ...mergeStoreSettings(getEnvDefaults(), record),
    updatedAt: normalizeUpdatedAt(record.updatedAt),
    source: 'database',
  });
}
