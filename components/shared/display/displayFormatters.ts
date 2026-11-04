import { DISPLAY_TEXT } from './displayText';

export function formatDisplayTime(value?: string | Date | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDisplayAddress(address?: string | null, city?: string | null): string {
  const parts = [address?.trim(), city?.trim()].filter(Boolean);
  return parts.length ? parts.join(', ') : DISPLAY_TEXT.noAddress;
}

export function formatDisplayItemCount(count?: number | null): string {
  return typeof count === 'number' && count > 0 ? `${count} פריטים` : DISPLAY_TEXT.noBreakdown;
}

export function formatDisplayPhoneHref(phone?: string | null): string | null {
  return phone ? `tel:${phone.replace(/\s+/g, '')}` : null;
}
