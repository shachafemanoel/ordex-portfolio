export * from '@/src/domain/status/legacyStatusMap';

/**
 * Maps status strings to canonical legacy display names.
 * Handles both Prisma statuses and known legacy aliases.
 */
const LEGACY_STATUS_DISPLAY_MAP: Record<string, string> = {
  // Prisma enum -> legacy display name
  SCHEDULED: 'SCHEDULE_INSTALL',
  PO_CREATED: 'PURCHASE_ORDER',
  AWAITING_STOCK: 'WAITING_GOODS',
  AWAITING_INSTALL: 'WAITING_INSTALL',
  CALL_BACK: 'CALLBACK_CUSTOMER',
  TO_DO: 'NEW',

  // Alternate legacy -> canonical legacy
  WAITING_SUPPLIER: 'WAITING_GOODS',
  PARTIAL: 'PARTIALLY_SUPPLIED',
};

export function normalizeStatus(statusRaw: string): string {
  if (!statusRaw) return statusRaw;
  const upper = statusRaw.toUpperCase().trim();
  return LEGACY_STATUS_DISPLAY_MAP[upper] || upper;
}
