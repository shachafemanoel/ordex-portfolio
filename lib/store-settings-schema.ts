import {
  BUSINESS_TIME_PATTERN,
  DEFAULT_BUSINESS_DAY_END_TIME,
  DEFAULT_BUSINESS_DAY_START_TIME,
  parseTimeStringToMinutes,
} from '@/lib/store-business-hours';
import { z } from 'zod';

export const STORE_SETTINGS_CURRENCIES = ['ILS', 'USD', 'EUR'] as const;
export const STORE_SETTINGS_LANGUAGES = ['he', 'en'] as const;
export const STORE_SETTINGS_TIMEZONES = ['Asia/Jerusalem', 'UTC'] as const;

const optionalText = z.string().trim().max(255).default('');
const optionalShortText = z.string().trim().max(120).default('');
const businessTime = z.string().trim().regex(BUSINESS_TIME_PATTERN, 'יש להזין שעה בפורמט HH:mm');
const optionalEmail = z
  .union([z.literal(''), z.string().trim().email('כתובת אימייל לא תקינה')])
  .default('');

const storeSettingsBaseSchema = z.object({
  storeName: z.string().trim().min(1, 'שם החנות הוא שדה חובה').max(120),
  storeEmail: optionalEmail,
  storePhone: z.string().trim().max(64).default(''),
  storeAddressLine: optionalText,
  storeCity: optionalShortText,
  defaultCurrency: z.enum(STORE_SETTINGS_CURRENCIES),
  timezone: z.string().trim().min(1, 'יש לבחור אזור זמן').max(80),
  language: z.enum(STORE_SETTINGS_LANGUAGES),
  taxRatePercent: z.coerce.number().min(0).max(100),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000),
  autoPurchaseOrder: z.boolean(),
  orderNumberPrefix: z.string().trim().min(1, 'קידומת הזמנה היא שדה חובה').max(20),
  businessDayStartTime: businessTime.default(DEFAULT_BUSINESS_DAY_START_TIME),
  businessDayEndTime: businessTime.default(DEFAULT_BUSINESS_DAY_END_TIME),
  useStoreAddressAsWarehouse: z.boolean(),
  warehouseAddressLine: optionalText,
  warehouseCity: optionalShortText,
  warehouseLat: z.number().nullable(),
  warehouseLng: z.number().nullable(),
});

export const storeSettingsSchema = storeSettingsBaseSchema.superRefine((value, ctx) => {
  if (
    parseTimeStringToMinutes(value.businessDayStartTime) >=
    parseTimeStringToMinutes(value.businessDayEndTime)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['businessDayEndTime'],
      message: 'שעת הסיום חייבת להיות מאוחרת משעת ההתחלה',
    });
  }
});

export const storeSettingsSnapshotSchema = storeSettingsBaseSchema
  .extend({
    updatedAt: z.string().nullable(),
    source: z.enum(['database', 'env']),
  })
  .superRefine((value, ctx) => {
    if (
      parseTimeStringToMinutes(value.businessDayStartTime) >=
      parseTimeStringToMinutes(value.businessDayEndTime)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['businessDayEndTime'],
        message: 'שעת הסיום חייבת להיות מאוחרת משעת ההתחלה',
      });
    }
  });

export type StoreSettingsDto = z.infer<typeof storeSettingsSchema>;
export type StoreSettingsSnapshot = z.infer<typeof storeSettingsSnapshotSchema>;

export function formatStoreAddress(parts: Array<string | null | undefined>): string {
  return parts
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)
    .join(', ');
}

export function resolveStoreRouteOrigin(
  settings: Pick<
    StoreSettingsDto,
    | 'storeAddressLine'
    | 'storeCity'
    | 'warehouseAddressLine'
    | 'warehouseCity'
    | 'warehouseLat'
    | 'warehouseLng'
    | 'useStoreAddressAsWarehouse'
  >
) {
  const useStoreAddress =
    settings.useStoreAddressAsWarehouse ||
    (!settings.warehouseAddressLine?.trim() && !settings.warehouseCity?.trim());

  const addressLine = useStoreAddress
    ? settings.storeAddressLine?.trim() || settings.warehouseAddressLine?.trim() || ''
    : settings.warehouseAddressLine?.trim() || settings.storeAddressLine?.trim() || '';
  const city = useStoreAddress
    ? settings.storeCity?.trim() || settings.warehouseCity?.trim() || ''
    : settings.warehouseCity?.trim() || settings.storeCity?.trim() || '';

  return {
    addressLine,
    city,
    lat: useStoreAddress ? null : settings.warehouseLat,
    lng: useStoreAddress ? null : settings.warehouseLng,
    label: formatStoreAddress([addressLine, city]) || null,
    mode: useStoreAddress ? ('store' as const) : ('warehouse' as const),
  };
}
