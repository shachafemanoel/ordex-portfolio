import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';

export const DEFAULT_BUSINESS_DAY_START_TIME = '09:00';
export const DEFAULT_BUSINESS_DAY_END_TIME = '18:00';
export const BUSINESS_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type StoreBusinessHours = {
  businessDayStartTime: string;
  businessDayEndTime: string;
  timezone: string;
};

export function parseTimeStringToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}

export function formatMinutesAsTimeString(value: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.trunc(value)));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getBusinessDayDurationMinutes(
  settings: Pick<StoreBusinessHours, 'businessDayStartTime' | 'businessDayEndTime'>
): number {
  return Math.max(
    0,
    parseTimeStringToMinutes(settings.businessDayEndTime) -
      parseTimeStringToMinutes(settings.businessDayStartTime)
  );
}

export function getBusinessHoursLabel(
  settings: Pick<StoreBusinessHours, 'businessDayStartTime' | 'businessDayEndTime'>
): string {
  return `${settings.businessDayStartTime}-${settings.businessDayEndTime}`;
}

export function getBusinessDayDateKey(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);

  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(
    shifted.getUTCDate()
  ).padStart(2, '0')}`;
}

export function getZonedTimeString(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, 'HH:mm');
}

export function shiftZonedDateByDays(date: Date, timeZone: string, days: number): Date {
  const dateKey = getBusinessDayDateKey(date, timeZone);
  const timePart = formatInTimeZone(date, timeZone, 'HH:mm:ss');

  return zonedTimeToUtc(`${addDaysToDateKey(dateKey, days)} ${timePart}`, timeZone);
}

export function getBusinessDayStartUtcForDateKey(
  dateKey: string,
  settings: StoreBusinessHours
): Date {
  return zonedTimeToUtc(`${dateKey} ${settings.businessDayStartTime}:00`, settings.timezone);
}

export function getBusinessDayUtcRange(
  date: Date,
  settings: StoreBusinessHours
): {
  dateKey: string;
  startUtc: Date;
  endUtc: Date;
} {
  const dateKey = getBusinessDayDateKey(date, settings.timezone);

  return {
    dateKey,
    startUtc: getBusinessDayStartUtcForDateKey(dateKey, settings),
    endUtc: zonedTimeToUtc(`${dateKey} ${settings.businessDayEndTime}:00`, settings.timezone),
  };
}

export function isBusinessTimeRangeWithinHours(
  rangeStart: string,
  rangeEnd: string,
  settings: Pick<StoreBusinessHours, 'businessDayStartTime' | 'businessDayEndTime'>
): boolean {
  const startMinutes = parseTimeStringToMinutes(rangeStart);
  const endMinutes = parseTimeStringToMinutes(rangeEnd);
  const businessStartMinutes = parseTimeStringToMinutes(settings.businessDayStartTime);
  const businessEndMinutes = parseTimeStringToMinutes(settings.businessDayEndTime);

  return (
    startMinutes >= businessStartMinutes &&
    endMinutes <= businessEndMinutes &&
    endMinutes > startMinutes
  );
}

export function resolveScheduleTimeRange(input: {
  scheduledAt: Date;
  scheduledEnd?: Date | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  durationMinutes?: number | null;
  timezone: string;
}) {
  const startTime = input.timeWindowStart ?? getZonedTimeString(input.scheduledAt, input.timezone);
  const endTime =
    input.timeWindowEnd ??
    getZonedTimeString(
      input.scheduledEnd ??
        new Date(input.scheduledAt.getTime() + Math.max(input.durationMinutes ?? 60, 1) * 60_000),
      input.timezone
    );

  return {
    dateKey: getBusinessDayDateKey(input.scheduledAt, input.timezone),
    startTime,
    endTime,
    startMinutes: parseTimeStringToMinutes(startTime),
    endMinutes: parseTimeStringToMinutes(endTime),
  };
}
