import { ApiError, createErrorResponse } from '@/lib/api-middleware';
import { z } from 'zod';
import { StoreAddressError } from './store-address';
import { StoreError } from './store-client';

export const ADMIN_ONLY_MESSAGE = 'רק מנהל העסק יכול לנהל את החיבור לחנות';

export const ConnectSchema = z.object({
  storeUrl: z.string().trim().min(4, 'יש להזין את כתובת החנות').max(300),
  consumerKey: z
    .string()
    .trim()
    .regex(/^ck_[A-Za-z0-9]{20,64}$/, 'Consumer Key מתחיל ב-ck_'),
  consumerSecret: z
    .string()
    .trim()
    .regex(/^cs_[A-Za-z0-9]{20,64}$/, 'Consumer Secret מתחיל ב-cs_'),
});

/** A store problem the admin can fix (address, keys, permissions) becomes a 400 with the reason. */
export function storeErrorResponse(error: unknown) {
  if (error instanceof ApiError)
    return createErrorResponse(error.message, error.statusCode, { code: error.code });
  if (error instanceof z.ZodError) return createErrorResponse('בקשה לא תקינה', 400);
  if (error instanceof StoreError || error instanceof StoreAddressError) {
    return createErrorResponse(
      error.message,
      400,
      error instanceof StoreError ? { code: error.code } : undefined
    );
  }
  throw error;
}
