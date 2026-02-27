export const SERBIA_TIME_ZONE = 'Europe/Belgrade';

type DateLike = Date | string | null | undefined;

type SerbiaDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_INPUT_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const pad = (value: number): string => String(value).padStart(2, '0');

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());
const isValidDateParts = (year: number, month: number, day: number): boolean => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= maxDay;
};
const isValidTimeParts = (hour: number, minute: number): boolean =>
  Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;

const readPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number => {
  const part = parts.find((item) => item.type === type);
  if (!part) return 0;
  const parsed = Number(part.value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const SERBIA_PARTS_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: SERBIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const getSerbiaDateParts = (value: Date): SerbiaDateParts => {
  const parts = SERBIA_PARTS_FORMATTER.formatToParts(value);
  return {
    year: readPart(parts, 'year'),
    month: readPart(parts, 'month'),
    day: readPart(parts, 'day'),
    hour: readPart(parts, 'hour'),
    minute: readPart(parts, 'minute'),
    second: readPart(parts, 'second'),
  };
};

const getSerbiaOffsetMinutes = (value: Date): number => {
  const parts = getSerbiaDateParts(value);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return (asUtc - value.getTime()) / 60_000;
};

const serbiaDateTimeToUtcDate = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const firstOffset = getSerbiaOffsetMinutes(new Date(utcGuess));
  let correctedMillis = utcGuess - firstOffset * 60_000;
  const secondOffset = getSerbiaOffsetMinutes(new Date(correctedMillis));
  if (secondOffset !== firstOffset) {
    correctedMillis = utcGuess - secondOffset * 60_000;
  }
  return new Date(correctedMillis);
};

const toDateFromDateOnly = (value: string): Date | null => {
  const match = DATE_ONLY_REGEX.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (!isValidDateParts(year, month, day)) return null;
  const parsed = serbiaDateTimeToUtcDate(year, month, day, 0, 0, 0);
  return isValidDate(parsed) ? parsed : null;
};

const toDateFromDateTimeInput = (value: string): Date | null => {
  const match = DATE_TIME_INPUT_REGEX.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }
  if (!isValidDateParts(year, month, day) || !isValidTimeParts(hour, minute)) return null;
  const parsed = serbiaDateTimeToUtcDate(year, month, day, hour, minute, 0);
  return isValidDate(parsed) ? parsed : null;
};

const coerceDate = (value: DateLike): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (DATE_TIME_INPUT_REGEX.test(trimmed)) {
    return toDateFromDateTimeInput(trimmed);
  }
  if (DATE_ONLY_REGEX.test(trimmed)) {
    return toDateFromDateOnly(trimmed);
  }

  const parsed = new Date(trimmed);
  return isValidDate(parsed) ? parsed : null;
};

const formatDateKey = (year: number, month: number, day: number): string =>
  `${year}-${pad(month)}-${pad(day)}`;

const parseDateKey = (value: string): { year: number; month: number; day: number } | null => {
  const match = DATE_ONLY_REGEX.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (!isValidDateParts(year, month, day)) return null;
  return { year, month, day };
};

export const getSerbiaNowDateKey = (): string => {
  const parts = getSerbiaDateParts(new Date());
  return formatDateKey(parts.year, parts.month, parts.day);
};

export const getSerbiaNowDateTimeInput = (): string => {
  const parts = getSerbiaDateParts(new Date());
  return `${formatDateKey(parts.year, parts.month, parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
};

export const toSerbiaDateKey = (value?: DateLike): string => {
  if (!value) return getSerbiaNowDateKey();

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const direct = parseDateKey(trimmed);
    if (direct) return formatDateKey(direct.year, direct.month, direct.day);
  }

  const parsed = coerceDate(value);
  if (!parsed) return '';
  const parts = getSerbiaDateParts(parsed);
  return formatDateKey(parts.year, parts.month, parts.day);
};

export const toSerbiaDateTimeInput = (value?: DateLike): string => {
  const parsed = value ? coerceDate(value) : new Date();
  if (!parsed) return '';
  const parts = getSerbiaDateParts(parsed);
  return `${formatDateKey(parts.year, parts.month, parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
};

export const serbiaDateTimeInputToIso = (value: string): string | null => {
  const parsed = toDateFromDateTimeInput(value);
  return parsed ? parsed.toISOString() : null;
};

export const serbiaDateInputToIso = (value: string): string | null => {
  const parsed = toDateFromDateOnly(value);
  return parsed ? parsed.toISOString() : null;
};

export const addDaysToDateKey = (value: string, days: number): string => {
  const parsed = parseDateKey(value);
  if (!parsed) return '';
  const base = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  base.setUTCDate(base.getUTCDate() + days);
  return formatDateKey(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
};

export const getDaysUntilDateKey = (targetDate: string, fromDate?: string): number | null => {
  const target = parseDateKey(targetDate);
  const from = parseDateKey(fromDate ?? getSerbiaNowDateKey());
  if (!target || !from) return null;
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  return Math.ceil((targetUtc - fromUtc) / (24 * 60 * 60 * 1000));
};

export const formatInSerbia = (
  value: DateLike,
  options: Intl.DateTimeFormatOptions,
  fallback = '—',
  locale = 'en-GB',
): string => {
  const parsed = coerceDate(value);
  if (!parsed) return fallback;
  return new Intl.DateTimeFormat(locale, {
    timeZone: SERBIA_TIME_ZONE,
    ...options,
  }).format(parsed);
};

export const formatSerbiaDate = (value?: DateLike, fallback = '—'): string =>
  formatInSerbia(value, { dateStyle: 'short' }, fallback);

export const formatSerbiaDateTime = (value?: DateLike, fallback = '—'): string =>
  formatInSerbia(value, { dateStyle: 'short', timeStyle: 'short' }, fallback);
